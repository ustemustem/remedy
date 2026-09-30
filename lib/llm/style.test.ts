import { describe, expect, it } from "vitest";
import { sanitizeDashes, stripDashes } from "./style";

describe("stripDashes", () => {
  it("turns a spaced em dash into a comma", () => {
    expect(stripDashes("Talk to your lead — then decide.")).toBe("Talk to your lead, then decide.");
  });

  it("turns an unspaced em dash into a comma", () => {
    expect(stripDashes("One owner—not three.")).toBe("One owner, not three.");
  });

  it("turns a spaced en dash into a comma", () => {
    expect(stripDashes("Start small – one team first.")).toBe("Start small, one team first.");
  });

  it("keeps a range as a hyphen", () => {
    expect(stripDashes("Try it for 2–3 weeks.")).toBe("Try it for 2-3 weeks.");
  });

  it("does not leave a comma before a period", () => {
    expect(stripDashes("Check the budget first —.")).toBe("Check the budget first.");
  });

  it("leaves text without dashes unchanged", () => {
    expect(stripDashes("Book a 30-minute call.")).toBe("Book a 30-minute call.");
  });
});

describe("sanitizeDashes", () => {
  it("cleans nested strings but keeps highlight text and urls verbatim", () => {
    const input = {
      suggestion: { title: "Ask — then act", options: [{ title: "A — B", subtitle: "x" }] },
      highlights: [{ text: "my boss — again", primaryTag: "Lead — ship" }],
      items: [{ url: "https://example.com/a—b", label: "Tool — one" }],
      count: 3,
      empty: null,
    };
    expect(sanitizeDashes(input)).toEqual({
      suggestion: { title: "Ask, then act", options: [{ title: "A, B", subtitle: "x" }] },
      highlights: [{ text: "my boss — again", primaryTag: "Lead, ship" }],
      items: [{ url: "https://example.com/a—b", label: "Tool, one" }],
      count: 3,
      empty: null,
    });
  });
});
