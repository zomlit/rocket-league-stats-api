import { describe, expect, it } from "vitest";

import { JsonFrameBuffer } from "./framer.js";

describe("JsonFrameBuffer", () => {
  it("yields each concatenated JSON object", () => {
    const buf = new JsonFrameBuffer();
    buf.push(Buffer.from(`{"a":1}{"b":2}{"c":3}`));
    expect([...buf.drain()]).toEqual([`{"a":1}`, `{"b":2}`, `{"c":3}`]);
  });

  it("preserves partial data across chunks", () => {
    const buf = new JsonFrameBuffer();
    buf.push(Buffer.from(`{"a":"hel`));
    expect([...buf.drain()]).toEqual([]);
    buf.push(Buffer.from(`lo"}`));
    expect([...buf.drain()]).toEqual([`{"a":"hello"}`]);
  });

  it("ignores braces inside strings and respects escape sequences", () => {
    const buf = new JsonFrameBuffer();
    // Mirrors the actual Stats API envelope where `Data` is a JSON string
    // packed with `{`, `}`, `"`, and `\`.
    const envelope = `{"Event":"UpdateState","Data":"{\\"k\\":\\"}{\\"}"}`;
    buf.push(Buffer.from(envelope));
    buf.push(Buffer.from(`{"Event":"BallHit","Data":"{}"}`));
    expect([...buf.drain()]).toEqual([envelope, `{"Event":"BallHit","Data":"{}"}`]);
  });

  it("resyncs to the next `{` if the stream desynchronizes", () => {
    const buf = new JsonFrameBuffer();
    buf.push(Buffer.from(`garbage{"ok":true}`));
    expect([...buf.drain()]).toEqual([`{"ok":true}`]);
  });

  it("handles whitespace between objects", () => {
    const buf = new JsonFrameBuffer();
    buf.push(Buffer.from(`{"a":1}\n  {"b":2}`));
    expect([...buf.drain()]).toEqual([`{"a":1}`, `{"b":2}`]);
  });

  it("frames a stream split across many tiny chunks", () => {
    const buf = new JsonFrameBuffer();
    const message = `{"Event":"UpdateState","Data":"{\\"x\\":42}"}`;
    for (const ch of message) {
      buf.push(Buffer.from(ch));
    }
    expect([...buf.drain()]).toEqual([message]);
    expect(buf.pending).toBe(0);
  });

  it("reset clears any held bytes", () => {
    const buf = new JsonFrameBuffer();
    buf.push(Buffer.from(`{"partial":`));
    expect(buf.pending).toBeGreaterThan(0);
    buf.reset();
    expect(buf.pending).toBe(0);
    expect([...buf.drain()]).toEqual([]);
  });
});
