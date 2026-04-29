/**
 * Live capture example.
 *
 * Connects to a running Rocket League with the Stats API enabled and prints
 * each event for ~10 seconds. Run with:
 *
 * ```sh
 * bun run example:capture
 * ```
 *
 * (Or `npm run example:capture` once tsx is installed.)
 *
 * Prerequisite: `DefaultStatsAPI.ini` must contain
 * `[TAGame.MatchStatsExporter_TA] / Port=49123 / PacketSendRate=10`, Rocket
 * League must be running, and a match must be active.
 */
import { RocketLeagueStatsClient } from "../src/index.js";

const DURATION_MS = 10_000;

async function main(): Promise<void> {
  const client = new RocketLeagueStatsClient({
    host: process.env.RL_STATS_HOST ?? "127.0.0.1",
    port: process.env.RL_STATS_PORT ? Number(process.env.RL_STATS_PORT) : 49123,
  });

  client.on("connected", () => console.log(`Connected to ${client.address}`));
  client.on("disconnected", ({ reason }) => console.log(`Disconnected (${reason})`));
  client.on("error", (err) => console.error("Socket error:", err.message));

  let updateStateCount = 0;
  client.on("UpdateState", (data) => {
    updateStateCount += 1;
    if (updateStateCount % 30 === 0) {
      const players = data.Players.length;
      const time = data.Game.TimeSeconds;
      console.log(`[UpdateState x${updateStateCount}] players=${players} clock=${time}s`);
    }
  });

  client.on("GoalScored", (data) => {
    console.log(`[GoalScored] ${data.Scorer?.Name ?? "?"} (speed=${data.GoalSpeed ?? "?"})`);
  });

  client.on("StatfeedEvent", (data) => {
    console.log(`[Statfeed] ${data.Type}/${data.EventName} → ${data.MainTarget?.Name ?? "?"}`);
  });

  client.on("MatchEnded", (data) => {
    console.log(`[MatchEnded] winner team=${data.WinnerTeamNum ?? "?"}`);
  });

  try {
    await client.connect();
  } catch (err) {
    console.error("Connect failed:", (err as Error).message);
    console.error("Is Rocket League running with the Stats API enabled?");
    process.exit(1);
  }

  await new Promise((resolve) => setTimeout(resolve, DURATION_MS));
  client.disconnect();
  console.log(`Captured ${updateStateCount} UpdateState frames in ${DURATION_MS}ms.`);
}

void main();
