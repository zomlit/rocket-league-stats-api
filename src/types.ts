/**
 * Type definitions for the Rocket League Stats API (`MatchStatsExporter_TA`).
 *
 * Source: https://www.rocketleague.com/en/developer/stats-api
 *
 * Notes from Psyonix's docs:
 * - Some `Player` fields are marked `SPECTATOR` — they only appear when the
 *   client is spectating or on that player's team.
 * - Some fields are marked `CONDITIONAL` — they only appear when relevant
 *   (for example `Attacker` is only set when the player was demolished).
 * - `Frame` and `Elapsed` on `Game` are not always present.
 *
 * The TypeScript types here mark spectator/conditional fields optional so the
 * compiler reflects reality. If you have authoritative information that a
 * field is always present in your environment, you can narrow with a custom
 * type guard.
 */

/** All event names emitted by the Stats API. */
export type StatsApiEventName =
  | "UpdateState"
  | "BallHit"
  | "ClockUpdatedSeconds"
  | "CountdownBegin"
  | "CrossbarHit"
  | "GoalReplayEnd"
  | "GoalReplayStart"
  | "GoalReplayWillEnd"
  | "GoalScored"
  | "MatchCreated"
  | "MatchDestroyed"
  | "MatchEnded"
  | "MatchInitialized"
  | "MatchPaused"
  | "MatchUnpaused"
  | "PodiumStart"
  | "ReplayCreated"
  | "RoundStarted"
  | "StatfeedEvent";

/**
 * Wire envelope as Rocket League sends it.
 *
 * `Data` is itself a JSON-encoded **string** in the wire format. The client
 * decodes it for you — consumers receive a parsed object via `client.on(...)`.
 */
export interface StatsApiEnvelope<E extends StatsApiEventName = StatsApiEventName> {
  Event: E;
  /** JSON-encoded string in the raw wire format. Decoded by the client. */
  Data: string;
}

/** A team identifier. `0` is Blue, `1` is Orange. */
export type TeamNum = 0 | 1;

/**
 * Identifier for a player or interaction target. The Stats API uses these to
 * reference players by short identity in event payloads (instead of repeating
 * the full Player record).
 */
export interface PlayerTarget {
  Name: string;
  /** Per-match unique short identifier. Stable across `UpdateState` ticks. */
  Shortcut: number;
  TeamNum: TeamNum;
  /**
   * Platform identifier such as `"Steam|76561198...|0"` or `"Epic|...|0"`.
   * **Note:** bot players report `"Unknown|0|0"` for every bot in the lobby,
   * so it is not safe to use as a unique key on its own — fall back to
   * `(TeamNum, Shortcut, Name)` when this stub is observed.
   */
  PrimaryId?: string;
}

/** Player-level fields in `UpdateState.Data.Players[]`. */
export interface Player extends PlayerTarget {
  /** Cumulative match score (Rocket League's points-per-action total). */
  Score?: number;
  Goals?: number;
  Shots?: number;
  Assists?: number;
  Saves?: number;
  Touches?: number;
  /** Number of car-on-ball touches; can be higher than `Touches`. */
  CarTouches?: number;
  Demos?: number;
  /** True while a car is currently spawned for this player. */
  bHasCar?: boolean;
  /** Speed in unreal units / second. SPECTATOR. */
  Speed?: number;
  /** 0–100 boost gauge value. SPECTATOR. */
  Boost?: number;
  bBoosting?: boolean;
  bOnGround?: boolean;
  bOnWall?: boolean;
  bPowersliding?: boolean;
  bDemolished?: boolean;
  bSupersonic?: boolean;
  /** Identity of the player who demolished this one. CONDITIONAL. */
  Attacker?: PlayerTarget;
}

/** A team entry inside `UpdateState.Data.Game.Teams[]`. */
export interface Team {
  Name: string;
  TeamNum: TeamNum;
  Score: number;
  /** 6-character RGB hex without the leading `#`, e.g. `"1873FF"`. */
  ColorPrimary?: string;
  /** 6-character RGB hex without the leading `#`. */
  ColorSecondary?: string;
}

/** Ball-state subobject within `UpdateState.Data.Game.Ball`. */
export interface Ball {
  Speed?: number;
  /** Last-touched team. */
  TeamNum?: TeamNum;
}

/** Game-state fields in `UpdateState.Data.Game`. */
export interface GameState {
  Teams: Team[];
  /** Time on the clock, in seconds. */
  TimeSeconds: number;
  bOvertime: boolean;
  Ball?: Ball;
  bReplay: boolean;
  bHasWinner: boolean;
  /** Winning side's name (only populated post-match). */
  Winner: string;
  /** Map identifier, e.g. `"Stadium_P"` or `"EuroStadium_Night_P"`. */
  Arena: string;
  /** True when the spectator camera is currently following a target. */
  bHasTarget: boolean;
  Target?: PlayerTarget;
  /** Sequential physics frame counter. CONDITIONAL. */
  Frame?: number;
  /** Wall-clock seconds since match start. CONDITIONAL. */
  Elapsed?: number;
}

/* -------------------------------------------------------------------------- */
/*  Per-event payload types                                                   */
/* -------------------------------------------------------------------------- */

export interface UpdateStateData {
  /** Stable per-match identifier. */
  MatchGuid: string;
  Players: Player[];
  Game: GameState;
}

export interface GoalScoredData {
  GoalSpeed?: number;
  GoalTime?: number;
  Scorer?: PlayerTarget;
  Assister?: PlayerTarget;
  BallLastTouch?: PlayerTarget;
  ImpactLocation?: { X: number; Y: number; Z: number };
  /**
   * Raw additional fields. Surfaces anything Rocket League adds in future
   * builds without a type bump.
   */
  [key: string]: unknown;
}

export interface MatchEndedData {
  WinnerTeamNum?: TeamNum;
  [key: string]: unknown;
}

export interface StatfeedTarget {
  Name: string;
  Shortcut: number;
  TeamNum: TeamNum;
}

export interface StatfeedEventData {
  /** Action label, e.g. `"Demolish"`, `"AerialGoal"`, `"Save"`. */
  EventName: string;
  /** Category, e.g. `"Demolition"`, `"Goal"`, `"Save"`. */
  Type: string;
  MainTarget?: StatfeedTarget;
  SecondaryTarget?: StatfeedTarget;
  [key: string]: unknown;
}

export interface BallHitData {
  Player?: PlayerTarget;
  Speed?: number;
  Location?: { X: number; Y: number; Z: number };
  [key: string]: unknown;
}

export interface ClockUpdatedSecondsData {
  TimeSeconds?: number;
  bOvertime?: boolean;
  [key: string]: unknown;
}

export interface MatchCreatedData {
  MatchGuid?: string;
  [key: string]: unknown;
}

export interface MatchInitializedData {
  MatchGuid?: string;
  [key: string]: unknown;
}

export interface MatchDestroyedData {
  MatchGuid?: string;
  [key: string]: unknown;
}

export interface CountdownBeginData {
  [key: string]: unknown;
}

export interface RoundStartedData {
  [key: string]: unknown;
}

export interface GoalReplayStartData {
  [key: string]: unknown;
}

export interface GoalReplayWillEndData {
  [key: string]: unknown;
}

export interface GoalReplayEndData {
  [key: string]: unknown;
}

export interface PodiumStartData {
  [key: string]: unknown;
}

export interface MatchPausedData {
  [key: string]: unknown;
}

export interface MatchUnpausedData {
  [key: string]: unknown;
}

export interface CrossbarHitData {
  [key: string]: unknown;
}

export interface ReplayCreatedData {
  [key: string]: unknown;
}

/**
 * Mapping from event name to the parsed `Data` payload type. Used to type the
 * client's `on(eventName, callback)` API.
 */
export interface StatsApiEventMap {
  UpdateState: UpdateStateData;
  GoalScored: GoalScoredData;
  MatchEnded: MatchEndedData;
  StatfeedEvent: StatfeedEventData;
  BallHit: BallHitData;
  ClockUpdatedSeconds: ClockUpdatedSecondsData;
  MatchCreated: MatchCreatedData;
  MatchInitialized: MatchInitializedData;
  MatchDestroyed: MatchDestroyedData;
  CountdownBegin: CountdownBeginData;
  RoundStarted: RoundStartedData;
  GoalReplayStart: GoalReplayStartData;
  GoalReplayWillEnd: GoalReplayWillEndData;
  GoalReplayEnd: GoalReplayEndData;
  PodiumStart: PodiumStartData;
  MatchPaused: MatchPausedData;
  MatchUnpaused: MatchUnpausedData;
  CrossbarHit: CrossbarHitData;
  ReplayCreated: ReplayCreatedData;
}

/** Connection lifecycle events. */
export interface ConnectionEventMap {
  /** Emitted once the TCP socket connects. */
  connected: void;
  /** Emitted when the socket closes (clean or otherwise). */
  disconnected: { reason: "closed" | "ended" | "error" | "manual"; error?: Error };
  /** Emitted on socket-level errors before disconnect. */
  error: Error;
  /**
   * Emitted when an incoming frame fails to parse as JSON. Useful for
   * diagnostic logging; the framer automatically resyncs at the next `{`.
   */
  parseError: { error: Error; frame: string };
  /**
   * Emitted for every successfully-decoded envelope, regardless of event.
   * Use this when you want a single place to log everything.
   */
  message: { event: StatsApiEventName; data: unknown };
}
