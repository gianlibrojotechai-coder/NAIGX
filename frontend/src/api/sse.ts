/**
 * The SSE wire format, parsed (D-74).
 *
 * Kept free of imports so it can be exercised outside a browser — the
 * grammar is small, and a parser that drops a frame split across two chunks
 * would lose exactly the events `FR-041` exists to show.
 */

/** One parsed SSE frame. `id` and `event` are optional in the protocol. */
export interface SseFrame {
  readonly id: string | null;
  readonly event: string | null;
  readonly data: string;
}

/**
 * Parses complete frames out of a growing buffer.
 *
 * The SSE grammar (WHATWG "Server-sent events"): a frame is lines separated by
 * `\n`, terminated by a blank line; a line is `field: value`, and a line
 * beginning with `:` is a comment. Multiple `data:` lines join with `\n`.
 * Returns the frames found and the unconsumed remainder, so a frame split
 * across two chunks is completed by the next read rather than dropped.
 *
 * Exported so it can be checked without a browser.
 */
export const parseSseFrames = (
  buffer: string,
): { frames: SseFrame[]; rest: string } => {
  const normalised = buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const frames: SseFrame[] = [];
  let rest = normalised;

  for (;;) {
    const boundary = rest.indexOf("\n\n");
    if (boundary === -1) break;
    const block = rest.slice(0, boundary);
    rest = rest.slice(boundary + 2);

    let id: string | null = null;
    let event: string | null = null;
    const data: string[] = [];
    for (const line of block.split("\n")) {
      if (line === "" || line.startsWith(":")) continue;
      const colon = line.indexOf(":");
      const field = colon === -1 ? line : line.slice(0, colon);
      let value = colon === -1 ? "" : line.slice(colon + 1);
      if (value.startsWith(" ")) value = value.slice(1);
      if (field === "id") id = value;
      else if (field === "event") event = value;
      else if (field === "data") data.push(value);
    }
    if (data.length === 0 && event === null && id === null) continue;
    frames.push({ id, event, data: data.join("\n") });
  }

  return { frames, rest };
};
