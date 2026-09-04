import { describe, it, expect } from "vitest";
import { parseEnv } from "./env";

describe("parseEnv", () => {
  it("parses KEY=VALUE lines", () => {
    expect(parseEnv("A=1\nB=two")).toEqual({ A: "1", B: "two" });
  });
  it("ignores blank lines and # comments", () => {
    expect(parseEnv("# c\n\nA=1\n   # d\n")).toEqual({ A: "1" });
  });
  it("keeps '=' inside the value", () => {
    expect(parseEnv("URL=https://x.y/?a=b")).toEqual({ URL: "https://x.y/?a=b" });
  });
  it("strips one layer of surrounding single or double quotes", () => {
    expect(parseEnv(`A="one"\nB='two'`)).toEqual({ A: "one", B: "two" });
  });
  it("trims whitespace around key and value", () => {
    expect(parseEnv("  A =  1 ")).toEqual({ A: "1" });
  });
});
