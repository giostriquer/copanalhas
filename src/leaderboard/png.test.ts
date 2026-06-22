import { describe, expect, test } from "vitest";

import { renderLeaderboardPng } from "./png.js";
import { renderLeaderboardDashboardSvg } from "./svg.js";

describe("renderLeaderboardPng", () => {
  test("renders the leaderboard SVG to a PNG buffer", async () => {
    const png = await renderLeaderboardPng(
      renderLeaderboardDashboardSvg({
        rows: [],
        generatedAtLabel: "2026-06-11 23:30 UTC"
      })
    );

    expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  });
});
