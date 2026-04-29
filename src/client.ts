import net from "node:net";
import { EventEmitter } from "node:events";

import { JsonFrameBuffer } from "./framer.js";
import { decodeEnvelope } from "./envelope.js";
import type {
  ConnectionEventMap,
  StatsApiEventMap,
  StatsApiEventName,
} from "./types.js";

export interface RocketLeagueStatsClientOptions {
  /** Host where Rocket League is listening. Default: `127.0.0.1`. */
  host?: string;
  /**
   * TCP port from `DefaultStatsAPI.ini`'s `Port=` directive.
   * Default: `49123`.
   */
  port?: number;
  /**
   * Connection timeout in ms. The promise returned by `connect()` rejects
   * after this many ms if the socket has not opened. Default: `5000`.
   */
  connectTimeoutMs?: number;
  /**
   * If true, automatically reconnect after disconnection with exponential
   * backoff. Default: `false` (the consumer drives reconnect).
   */
  autoReconnect?: boolean;
  /**
   * Initial reconnect delay in ms. Doubles up to `maxReconnectDelayMs`.
   * Default: `1500`.
   */
  reconnectDelayMs?: number;
  /** Cap on reconnect backoff. Default: `30000`. */
  maxReconnectDelayMs?: number;
}

type Listener<T> = T extends void ? () => void : (payload: T) => void;

/**
 * Rocket League Stats API client.
 *
 * The Stats API (`MatchStatsExporter_TA`) is a local TCP socket — *not* a
 * WebSocket — that streams JSON events while a match is active. This client
 * connects, frames the byte stream, decodes the envelope (`{ Event, Data }`
 * where `Data` is a JSON-encoded string), and emits typed events.
 *
 * @example
 * ```ts
 * import { RocketLeagueStatsClient } from "rocket-league-stats-api";
 *
 * const client = new RocketLeagueStatsClient();
 *
 * client.on("connected", () => console.log("connected"));
 * client.on("UpdateState", (data) => {
 *   console.log(`${data.Players.length} players, clock ${data.Game.TimeSeconds}s`);
 * });
 * client.on("GoalScored", (data) => {
 *   console.log(`Goal by ${data.Scorer?.Name}`);
 * });
 *
 * await client.connect();
 * ```
 */
export class RocketLeagueStatsClient {
  private readonly host: string;
  private readonly port: number;
  private readonly connectTimeoutMs: number;
  private readonly autoReconnect: boolean;
  private readonly initialReconnectDelay: number;
  private readonly maxReconnectDelay: number;

  private socket: net.Socket | null = null;
  private framer = new JsonFrameBuffer();
  private emitter = new EventEmitter();
  private manuallyClosed = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private currentReconnectDelay: number;

  constructor(options: RocketLeagueStatsClientOptions = {}) {
    this.host = options.host ?? "127.0.0.1";
    this.port = options.port ?? 49123;
    this.connectTimeoutMs = options.connectTimeoutMs ?? 5000;
    this.autoReconnect = options.autoReconnect ?? false;
    this.initialReconnectDelay = options.reconnectDelayMs ?? 1500;
    this.maxReconnectDelay = options.maxReconnectDelayMs ?? 30000;
    this.currentReconnectDelay = this.initialReconnectDelay;
    this.emitter.setMaxListeners(50);
    // Node's EventEmitter throws when `error` is emitted with no listener.
    // Consumers may not always attach one (e.g. they only care about
    // `disconnected`), so swallow unhandled errors here. The promise returned
    // by `connect()` still rejects with the original error.
    this.emitter.on("error", () => {});
  }

  /** True while a TCP socket is connected. */
  get connected(): boolean {
    return !!this.socket && !this.socket.destroyed && this.socket.readyState === "open";
  }

  /** The configured remote address as `host:port`. */
  get address(): string {
    return `${this.host}:${this.port}`;
  }

  /**
   * Open the TCP socket. Resolves once `connect` fires; rejects on error or
   * timeout. After the initial promise settles, reconnects (if enabled) are
   * surfaced as `connected` / `disconnected` events.
   */
  connect(): Promise<void> {
    this.manuallyClosed = false;
    return this.openSocket();
  }

  /** Close the socket and cancel any pending reconnect. */
  disconnect(): void {
    this.manuallyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket && !this.socket.destroyed) {
      this.socket.end();
      this.socket.destroy();
    }
    this.socket = null;
    this.framer.reset();
  }

  /* ------------------------------------------------------------------ */
  /* Typed event subscription API                                       */
  /* ------------------------------------------------------------------ */

  on<E extends StatsApiEventName>(event: E, listener: Listener<StatsApiEventMap[E]>): this;
  on<E extends keyof ConnectionEventMap>(event: E, listener: Listener<ConnectionEventMap[E]>): this;
  on(event: string, listener: (...args: unknown[]) => void): this {
    this.emitter.on(event, listener);
    return this;
  }

  once<E extends StatsApiEventName>(event: E, listener: Listener<StatsApiEventMap[E]>): this;
  once<E extends keyof ConnectionEventMap>(event: E, listener: Listener<ConnectionEventMap[E]>): this;
  once(event: string, listener: (...args: unknown[]) => void): this {
    this.emitter.once(event, listener);
    return this;
  }

  off<E extends StatsApiEventName>(event: E, listener: Listener<StatsApiEventMap[E]>): this;
  off<E extends keyof ConnectionEventMap>(event: E, listener: Listener<ConnectionEventMap[E]>): this;
  off(event: string, listener: (...args: unknown[]) => void): this {
    this.emitter.off(event, listener);
    return this;
  }

  /** Remove every listener for every event. */
  removeAllListeners(): this {
    this.emitter.removeAllListeners();
    return this;
  }

  /* ------------------------------------------------------------------ */
  /* Internals                                                          */
  /* ------------------------------------------------------------------ */

  private openSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const sock = net.createConnection({ host: this.host, port: this.port });
      this.socket = sock;
      this.framer.reset();

      let settled = false;
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        sock.destroy(new Error(`Connect timed out after ${this.connectTimeoutMs}ms`));
      }, this.connectTimeoutMs);

      sock.once("connect", () => {
        clearTimeout(timeout);
        if (settled) return;
        settled = true;
        this.currentReconnectDelay = this.initialReconnectDelay;
        this.emitter.emit("connected");
        resolve();
      });

      sock.on("data", (chunk: Buffer) => {
        this.framer.push(chunk);
        for (const raw of this.framer.drain()) {
          const decoded = decodeEnvelope(raw);
          if (!decoded) {
            this.emitter.emit("parseError", {
              error: new Error("Failed to decode envelope"),
              frame: raw,
            });
            continue;
          }
          this.emitter.emit("message", decoded);
          this.emitter.emit(decoded.event, decoded.data);
        }
      });

      sock.on("error", (err) => {
        clearTimeout(timeout);
        this.emitter.emit("error", err);
        if (!settled) {
          settled = true;
          reject(err);
        }
      });

      sock.on("close", () => {
        clearTimeout(timeout);
        const wasManual = this.manuallyClosed;
        this.socket = null;
        this.framer.reset();
        this.emitter.emit("disconnected", { reason: wasManual ? "manual" : "closed" });
        if (this.autoReconnect && !wasManual) {
          this.scheduleReconnect();
        }
      });

      sock.on("end", () => {
        // `close` will fire after `end`; nothing to do here.
      });
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || this.manuallyClosed) return;
    const delay = this.currentReconnectDelay;
    this.currentReconnectDelay = Math.min(delay * 2, this.maxReconnectDelay);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openSocket().catch(() => {
        // Errors are emitted on the `error` channel; let the close handler
        // schedule the next attempt.
      });
    }, delay);
  }
}
