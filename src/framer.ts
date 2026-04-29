/**
 * Rocket League's `MatchStatsExporter_TA` writes a stream of concatenated JSON
 * objects with no delimiter — the next message starts immediately after the
 * previous closing `}`. This module pulls complete JSON objects out of that
 * byte stream, with proper handling for strings (which may contain `{` and
 * `}`) and backslash escapes.
 *
 * Resync behavior: if the buffer starts with non-`{` garbage (which should
 * never happen on a healthy stream), the framer skips ahead to the next `{`
 * rather than dead-locking.
 */
export class JsonFrameBuffer {
  private buf: Buffer = Buffer.alloc(0);

  /** Append a chunk read from the socket. */
  push(chunk: Buffer): void {
    this.buf = this.buf.length === 0 ? Buffer.from(chunk) : Buffer.concat([this.buf, chunk]);
  }

  /**
   * Yields each complete top-level JSON object as a UTF-8 string and drains
   * those bytes from the buffer. Stops when no full object is available;
   * partial data is preserved for the next `push`.
   */
  *drain(): Generator<string> {
    let cursor = 0;

    while (cursor < this.buf.length) {
      // Skip whitespace and resync to the next `{`.
      while (cursor < this.buf.length && this.buf[cursor] !== 0x7b /* { */) {
        cursor += 1;
      }
      if (cursor >= this.buf.length) break;

      const start = cursor;
      let depth = 0;
      let inString = false;
      let escape = false;
      let end = -1;

      for (let i = start; i < this.buf.length; i += 1) {
        const b = this.buf[i];
        if (escape) {
          escape = false;
          continue;
        }
        if (inString) {
          if (b === 0x5c /* \ */) {
            escape = true;
          } else if (b === 0x22 /* " */) {
            inString = false;
          }
          continue;
        }
        if (b === 0x22) {
          inString = true;
        } else if (b === 0x7b) {
          depth += 1;
        } else if (b === 0x7d /* } */) {
          depth -= 1;
          if (depth === 0) {
            end = i;
            break;
          }
        }
      }

      if (end < 0) {
        // Need more data — preserve everything from `start` onward.
        break;
      }

      yield this.buf.subarray(start, end + 1).toString("utf8");
      cursor = end + 1;
    }

    // Drain whatever we successfully consumed.
    this.buf = this.buf.subarray(cursor);
  }

  /** Bytes currently held but not yet yielded. */
  get pending(): number {
    return this.buf.length;
  }

  /** Reset the buffer (used by tests and on reconnect). */
  reset(): void {
    this.buf = Buffer.alloc(0);
  }
}
