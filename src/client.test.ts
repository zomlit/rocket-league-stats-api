import { afterEach, describe, expect, it } from "vitest";
import net from "node:net";

import { RocketLeagueStatsClient } from "./client.js";
import type { UpdateStateData } from "./types.js";

/**
 * Spin up a local TCP server that mimics Rocket League's MatchStatsExporter
 * — concatenated JSON envelopes with no delimiter, where `Data` is a
 * JSON-encoded string. The first connected client receives the scripted
 * frames, then the connection closes.
 */
function startMockExporter(frames: object[]): Promise<{ port: number; stop: () => Promise<void> }> {
  return new Promise((resolve, reject) => {
    const server = net.createServer((socket) => {
      const wire = frames
        .map((frame) =>
          JSON.stringify({
            Event: (frame as { Event: string }).Event,
            Data: JSON.stringify((frame as { Data: unknown }).Data),
          }),
        )
        .join("");
      socket.write(wire, () => socket.end());
    });
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Mock server failed to bind"));
        return;
      }
      resolve({
        port: address.port,
        stop: () =>
          new Promise<void>((closeResolve, closeReject) => {
            server.close((err) => (err ? closeReject(err) : closeResolve()));
          }),
      });
    });
  });
}

describe("RocketLeagueStatsClient", () => {
  let stopServer: (() => Promise<void>) | null = null;

  afterEach(async () => {
    if (stopServer) {
      await stopServer();
      stopServer = null;
    }
  });

  it("connects, decodes events, and emits typed payloads", async () => {
    const updateState: UpdateStateData = {
      MatchGuid: "MOCK",
      Players: [
        { Name: "Tester", PrimaryId: "Steam|1|0", Shortcut: 1, TeamNum: 0, Boost: 75 },
      ],
      Game: {
        Teams: [
          { Name: "Blue", TeamNum: 0, Score: 1 },
          { Name: "Orange", TeamNum: 1, Score: 0 },
        ],
        TimeSeconds: 180,
        bOvertime: false,
        bReplay: false,
        bHasWinner: false,
        Winner: "",
        Arena: "Stadium_P",
        bHasTarget: false,
      },
    };

    const { port, stop } = await startMockExporter([
      { Event: "UpdateState", Data: updateState },
      { Event: "GoalScored", Data: { GoalSpeed: 88.5 } },
    ]);
    stopServer = stop;

    const client = new RocketLeagueStatsClient({ host: "127.0.0.1", port });
    const received: Array<{ event: string; data: unknown }> = [];
    let connected = 0;
    let disconnected = 0;

    client.on("connected", () => {
      connected += 1;
    });
    client.on("UpdateState", (data) => {
      received.push({ event: "UpdateState", data });
    });
    client.on("GoalScored", (data) => {
      received.push({ event: "GoalScored", data });
    });

    const closed = new Promise<void>((resolve) => {
      client.on("disconnected", () => {
        disconnected += 1;
        resolve();
      });
    });

    await client.connect();
    await closed;

    expect(connected).toBe(1);
    expect(disconnected).toBe(1);
    expect(received).toEqual([
      { event: "UpdateState", data: updateState },
      { event: "GoalScored", data: { GoalSpeed: 88.5 } },
    ]);
  });

  it("rejects connect() when the host is unreachable", async () => {
    // Port 1 is reserved/unbound on Windows so the connection will be refused
    // immediately rather than hitting the timeout path.
    const client = new RocketLeagueStatsClient({
      host: "127.0.0.1",
      port: 1,
      connectTimeoutMs: 1000,
    });
    await expect(client.connect()).rejects.toBeInstanceOf(Error);
    client.disconnect();
  });
});
