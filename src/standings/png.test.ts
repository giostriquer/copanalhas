import { describe, expect, test } from "vitest";

import { renderStandingsPng } from "./png.js";
import { renderStandingsDashboardSvg } from "./svg.js";
import { computeGroupStandings } from "./standings.js";
import { WORLD_CUP_2026_SEED } from "../worldcup/seed.js";

describe("renderStandingsPng", () => {
  test("renders the standings SVG with embedded flags to a PNG buffer", async () => {
    const standings = computeGroupStandings(WORLD_CUP_2026_SEED.matches, [
      { matchId: "wc2026-001", homeScore: 2, awayScore: 1 }
    ]);
    const png = await renderStandingsPng(
      renderStandingsDashboardSvg({
        standings,
        groups: ["A", "B", "C", "D", "E", "F"],
        label: "Grupos A-F",
        generatedAtLabel: "2026-06-11 23:30 UTC"
      })
    );

    expect(png.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    );
    expect(png.length).toBeGreaterThan(1000);
  });
});
