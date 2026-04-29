/**
 * @packageDocumentation
 *
 * `rocket-league-stats-api` is a TypeScript client for Rocket League's
 * official Stats API (`MatchStatsExporter_TA`). The Stats API is a local TCP
 * socket that streams JSON events while a match is in progress.
 *
 * Quick start:
 *
 * ```ts
 * import { RocketLeagueStatsClient } from "rocket-league-stats-api";
 *
 * const client = new RocketLeagueStatsClient({ host: "127.0.0.1", port: 49123 });
 * client.on("connected", () => console.log("connected"));
 * client.on("UpdateState", (data) => console.log(data));
 * await client.connect();
 * ```
 *
 * See {@link RocketLeagueStatsClient} for the full API and {@link types} for
 * the event payload shapes.
 */

export { RocketLeagueStatsClient } from "./client.js";
export type { RocketLeagueStatsClientOptions } from "./client.js";

export { JsonFrameBuffer } from "./framer.js";
export { decodeEnvelope } from "./envelope.js";
export type { DecodedEnvelope } from "./envelope.js";

export type {
  // Event names + envelope
  StatsApiEventName,
  StatsApiEnvelope,
  StatsApiEventMap,
  ConnectionEventMap,
  // Core entity types
  TeamNum,
  Player,
  PlayerTarget,
  Team,
  Ball,
  GameState,
  // Per-event payload types
  UpdateStateData,
  GoalScoredData,
  MatchEndedData,
  StatfeedTarget,
  StatfeedEventData,
  BallHitData,
  ClockUpdatedSecondsData,
  MatchCreatedData,
  MatchInitializedData,
  MatchDestroyedData,
  CountdownBeginData,
  RoundStartedData,
  GoalReplayStartData,
  GoalReplayWillEndData,
  GoalReplayEndData,
  PodiumStartData,
  MatchPausedData,
  MatchUnpausedData,
  CrossbarHitData,
  ReplayCreatedData,
} from "./types.js";
