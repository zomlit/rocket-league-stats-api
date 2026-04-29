import type { StatsApiEnvelope, StatsApiEventName } from "./types.js";

/** Decoded envelope returned to consumers (with `Data` already JSON-parsed). */
export interface DecodedEnvelope {
  event: StatsApiEventName;
  data: unknown;
}

/**
 * Parse a single JSON object emitted by Rocket League's exporter.
 *
 * The wire format is:
 *
 * ```json
 * { "Event": "UpdateState", "Data": "{\"MatchGuid\":\"...\"}" }
 * ```
 *
 * — i.e. `Data` is a JSON-encoded **string**, not a nested object. This
 * function decodes both layers and returns a stable `{ event, data }` shape.
 *
 * Returns `null` and does not throw if:
 * - the outer text is not valid JSON,
 * - the envelope is missing an `Event` field,
 * - or the inner `Data` string is not valid JSON.
 *
 * If `Data` is already an object (some custom forks emit it that way), it is
 * passed through unchanged. If `Data` is missing entirely, `data` is `null`.
 */
export function decodeEnvelope(rawJson: string): DecodedEnvelope | null {
  let envelope: Partial<StatsApiEnvelope> & { Data?: unknown };
  try {
    envelope = JSON.parse(rawJson) as Partial<StatsApiEnvelope> & { Data?: unknown };
  } catch {
    return null;
  }

  const event = envelope.Event;
  if (typeof event !== "string") return null;

  let data: unknown = null;
  if (typeof envelope.Data === "string") {
    try {
      data = JSON.parse(envelope.Data);
    } catch {
      // The official format is a JSON string. If parsing fails, surface the
      // raw string so consumers can still log it for diagnostics.
      data = envelope.Data;
    }
  } else if (envelope.Data !== undefined) {
    data = envelope.Data;
  }

  return { event: event as StatsApiEventName, data };
}
