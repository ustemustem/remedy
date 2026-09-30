import { describe, expect, it } from "vitest";
import { plainStyle } from "./checks";

describe("plainStyle", () => {
  it("passes short plain sentences", () => {
    expect(plainStyle(["Book a 30-minute call. Ask one question.", "Try it for 2-3 weeks."]).pass).toBe(true);
  });

  it("fails on an em dash", () => {
    expect(plainStyle(["Ask first — then act."]).pass).toBe(false);
  });

  it("fails on a spaced en dash but not a range", () => {
    expect(plainStyle(["Ask first – then act."]).pass).toBe(false);
    expect(plainStyle(["Run it for 2–3 weeks."]).pass).toBe(true);
  });

  it("fails on a semicolon", () => {
    expect(plainStyle(["Ask first; then act."]).pass).toBe(false);
  });

  it("fails on a sentence over 20 words", () => {
    const long = Array.from({ length: 21 }, () => "word").join(" ") + ".";
    const r = plainStyle([long]);
    expect(r.pass).toBe(false);
    expect(r.detail).toContain("21-word sentence");
  });
});
