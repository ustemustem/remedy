import { describe, expect, it } from "vitest";
import { pathPoints, segmentBoxes, simplifyRoute } from "./edge-segments";

describe("simplifyRoute", () => {
  it("keeps only the corners, so a run's ordinal does not depend on stubs or curves", () => {
    // Source stub, vertical run, 4px rounded corner (Q end), horizontal run, corner, vertical run, target stub.
    const points = pathPoints(
      "M100 0L100 20L 100,96Q 100,100 104,100L 296,100Q 300,100 300,104L300 180L300 200"
    );
    expect(simplifyRoute(points)).toEqual([
      { x: 100, y: 0 },
      { x: 100, y: 96 },
      { x: 104, y: 100 },
      { x: 296, y: 100 },
      { x: 300, y: 104 },
      { x: 300, y: 200 },
    ]);
  });

  it("collapses a straight edge to one run, and drops repeated points", () => {
    const points = pathPoints("M100 0L100 20L100 20L100 180L100 200");
    expect(simplifyRoute(points)).toEqual([
      { x: 100, y: 0 },
      { x: 100, y: 200 },
    ]);
  });
});

describe("pathPoints", () => {
  it("reads M, L and the end point of Q, with spaces or commas", () => {
    const d = "M10 20L10 40L 10,96Q 10,100 14,100L 200,100";
    expect(pathPoints(d)).toEqual([
      { x: 10, y: 20 },
      { x: 10, y: 40 },
      { x: 10, y: 96 },
      { x: 14, y: 100 },
      { x: 200, y: 100 },
    ]);
  });

  it("reads negative and decimal numbers", () => {
    expect(pathPoints("M-5.5 1.25L-50.93 480.98")).toEqual([
      { x: -5.5, y: 1.25 },
      { x: -50.93, y: 480.98 },
    ]);
  });
});

describe("segmentBoxes", () => {
  it("makes one padded box per straight run and skips zero-length runs", () => {
    const boxes = segmentBoxes(
      [
        { x: 10, y: 20 },
        { x: 10, y: 20 },
        { x: 10, y: 60 },
        { x: 50, y: 60 },
      ],
      4
    );
    expect(boxes).toEqual([
      { left: 6, top: 16, right: 14, bottom: 64 },
      { left: 6, top: 56, right: 54, bottom: 64 },
    ]);
  });
});
