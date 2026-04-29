# rocket-league-stats-api

[![npm](https://img.shields.io/npm/v/rocket-league-stats-api.svg)](https://www.npmjs.com/package/rocket-league-stats-api)
[![CI](https://github.com/zomlit/rocket-league-stats-api/actions/workflows/ci.yml/badge.svg)](https://github.com/zomlit/rocket-league-stats-api/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

TypeScript client for [Rocket League's official Stats API](https://www.rocketleague.com/en/developer/stats-api) (`MatchStatsExporter_TA`). Connects to the local TCP socket Rocket League opens during matches, frames the raw JSON stream, decodes the envelope, and emits fully typed events.

> **Heads-up:** the Stats API is a **raw TCP socket** that streams concatenated JSON — *not* a WebSocket — and `Data` is a JSON-encoded **string**, not a nested object. Both points are easy to miss; this package handles them for you.

## Install

```sh
npm install rocket-league-stats-api
# or
bun add rocket-league-stats-api
```

Requires Node.js 20+ or Bun. Browser environments are not supported (no raw TCP).

## Enable the Stats API in Rocket League

The exporter is off by default. Edit (or create) this file before launching Rocket League:

```
<Rocket League install>\TAGame\Config\DefaultStatsAPI.ini
```

Paste the following and save:

```ini
[TAGame.MatchStatsExporter_TA]
Port=49123
PacketSendRate=10
```

- `PacketSendRate` is updates per second (1–120). `0` disables the API.
- The section header `[TAGame.MatchStatsExporter_TA]` is required.
- Restart Rocket League after editing the file.
- Events only stream while a match is active — saved-replay viewing does not produce data.

## Quick start

```ts
import { RocketLeagueStatsClient } from "rocket-league-stats-api";

const client = new RocketLeagueStatsClient({
  host: "127.0.0.1", // default
  port: 49123,        // default; matches DefaultStatsAPI.ini Port
});

client.on("connected", () => console.log("Connected"));
client.on("disconnected", ({ reason }) => console.log(`Disconnected (${reason})`));
client.on("error", (err) => console.error(err));

client.on("UpdateState", (data) => {
  console.log(`${data.Players.length} players, clock ${data.Game.TimeSeconds}s`);
});

client.on("GoalScored", (data) => {
  console.log(`Goal by ${data.Scorer?.Name} (speed ${data.GoalSpeed})`);
});

await client.connect();
```

## API

### `new RocketLeagueStatsClient(options?)`

Options:

| Option                | Type      | Default            | Description                                                            |
| --------------------- | --------- | ------------------ | ---------------------------------------------------------------------- |
| `host`                | `string`  | `"127.0.0.1"`      | Host where Rocket League is listening.                                 |
| `port`                | `number`  | `49123`            | Port from `DefaultStatsAPI.ini`'s `Port=` directive.                   |
| `connectTimeoutMs`    | `number`  | `5000`             | Initial-connect timeout. After timeout, `connect()` rejects.           |
| `autoReconnect`       | `boolean` | `false`            | If true, reconnects with exponential backoff after the socket closes.  |
| `reconnectDelayMs`    | `number`  | `1500`             | Initial reconnect delay (only used when `autoReconnect: true`).        |
| `maxReconnectDelayMs` | `number`  | `30000`            | Cap on reconnect backoff.                                              |

### `client.connect(): Promise<void>`

Opens the socket. Resolves once `connect` fires, or rejects on socket error / timeout.

### `client.disconnect(): void`

Closes the socket and cancels any pending reconnect.

### `client.on(event, listener)` / `.once(event, listener)` / `.off(event, listener)`

Subscribe to game or lifecycle events. Listeners are typed: `client.on("UpdateState", data => ...)` infers `data` as `UpdateStateData`.

#### Game events

Every event documented by Psyonix is forwarded with its parsed payload:

`UpdateState`, `GoalScored`, `MatchEnded`, `StatfeedEvent`, `BallHit`, `ClockUpdatedSeconds`, `MatchCreated`, `MatchInitialized`, `MatchDestroyed`, `CountdownBegin`, `RoundStarted`, `GoalReplayStart`, `GoalReplayWillEnd`, `GoalReplayEnd`, `PodiumStart`, `MatchPaused`, `MatchUnpaused`, `CrossbarHit`, `ReplayCreated`.

#### Lifecycle events

| Event           | Payload                                                                       |
| --------------- | ----------------------------------------------------------------------------- |
| `connected`     | `void`                                                                        |
| `disconnected`  | `{ reason: "closed" \| "ended" \| "error" \| "manual"; error?: Error }`       |
| `error`         | `Error`                                                                       |
| `parseError`    | `{ error: Error; frame: string }`                                             |
| `message`       | `{ event: StatsApiEventName; data: unknown }` — fires for **every** message   |

### Types

All types are exported from the package root, including `Player`, `Team`, `GameState`, `UpdateStateData`, `GoalScoredData`, `StatfeedEventData`, etc. The full event-name → payload-type mapping is `StatsApiEventMap`.

### Low-level utilities

If you want to plug the framer or the envelope decoder into your own transport (e.g., piping captured fixtures back through the same parsing pipeline), import them directly:

```ts
import { JsonFrameBuffer, decodeEnvelope } from "rocket-league-stats-api";

const buf = new JsonFrameBuffer();
buf.push(socketChunk);
for (const raw of buf.drain()) {
  const decoded = decodeEnvelope(raw);
  // { event, data }
}
```

## Gotchas worth knowing

- **Bot matches collapse `PrimaryId`.** Every bot in a private match reports `PrimaryId: "Unknown|0|0"`. If you key your own player map by `PrimaryId` alone, every bot collapses into one entry. Use `(TeamNum, Shortcut, Name)` as a fallback.
- **Boost is spectator-scoped.** The `Boost` field on `Player` only appears when the client is spectating or on that player's team. Treat it as optional and render `--` when absent rather than assuming `0`.
- **Saved-replay viewing emits nothing.** The exporter only streams during live matches, online or private.
- **No position data.** The Stats API does not document continuous player or ball positions, so minimaps and heatmaps are not implementable from this feed alone.

## Examples

The [`examples/`](examples) folder has runnable scripts. Run the live capture against your local Rocket League:

```sh
bun run example:capture
# or
npx tsx examples/capture.ts
```

## Development

```sh
bun install
bun test
bun run typecheck
bun run build
```

The framer and envelope decoder are pure-function modules with full unit-test coverage; the client has integration-style tests against a local TCP mock.

## Disclaimer

This package is not affiliated with, endorsed by, or sponsored by Psyonix, LLC or Epic Games, Inc. *Rocket League* is a registered trademark of Psyonix, LLC. All event names and field shapes match the public Stats API spec at the time of writing — Psyonix may add, remove, or rename fields without notice.

## License

[MIT](LICENSE)
