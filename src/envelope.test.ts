import { describe, expect, it } from "vitest";

import { decodeEnvelope } from "./envelope.js";

describe("decodeEnvelope", () => {
  it("decodes the wire format with Data as a JSON-encoded string", () => {
    const wire = JSON.stringify({
      Event: "UpdateState",
      Data: JSON.stringify({ MatchGuid: "abc", Players: [], Game: { TimeSeconds: 60 } }),
    });

    expect(decodeEnvelope(wire)).toEqual({
      event: "UpdateState",
      data: { MatchGuid: "abc", Players: [], Game: { TimeSeconds: 60 } },
    });
  });

  it("passes through Data when it is already an object", () => {
    const wire = JSON.stringify({
      Event: "GoalScored",
      Data: { GoalSpeed: 88.5, Scorer: { Name: "Player1", TeamNum: 0, Shortcut: 1 } },
    });

    expect(decodeEnvelope(wire)).toEqual({
      event: "GoalScored",
      data: { GoalSpeed: 88.5, Scorer: { Name: "Player1", TeamNum: 0, Shortcut: 1 } },
    });
  });

  it("returns null for malformed JSON", () => {
    expect(decodeEnvelope(`not json`)).toBeNull();
    expect(decodeEnvelope(`{"Event":"UpdateState"`)).toBeNull();
  });

  it("returns null when Event is missing", () => {
    expect(decodeEnvelope(JSON.stringify({ Data: "{}" }))).toBeNull();
  });

  it("falls back to the raw string when Data fails to parse as JSON", () => {
    const wire = JSON.stringify({ Event: "UpdateState", Data: "not-json{{{" });
    expect(decodeEnvelope(wire)).toEqual({
      event: "UpdateState",
      data: "not-json{{{",
    });
  });

  it("returns null data when Data is omitted", () => {
    const wire = JSON.stringify({ Event: "MatchInitialized" });
    expect(decodeEnvelope(wire)).toEqual({
      event: "MatchInitialized",
      data: null,
    });
  });
});
