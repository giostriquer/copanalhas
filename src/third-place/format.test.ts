import { Buffer } from "node:buffer";
import { describe, expect, test } from "vitest";

import { createThirdPlaceDashboardMessage, THIRD_PLACE_ATTACHMENT_NAME } from "./format.js";
import type { ThirdPlaceStandings } from "./standings.js";

describe("createThirdPlaceDashboardMessage", () => {
  test("creates the image payload for the third-place dashboard", () => {
    const message = createThirdPlaceDashboardMessage({
      standings: standings(),
      updatedAt: new Date("2026-06-24T21:00:00.000Z"),
      timeZone: "America/Sao_Paulo",
      png: Buffer.from("png")
    });

    expect(message.content).toContain("Copa do Mundo 2026 - Melhores terceiros");
    expect(message.content).toContain("Verde avança | Amarelo no corte | Vermelho fora");
    expect(message.files).toEqual([
      { attachment: Buffer.from("png"), name: THIRD_PLACE_ATTACHMENT_NAME }
    ]);
  });

  test("falls back to a compact text table when rendering fails", () => {
    const message = createThirdPlaceDashboardMessage({
      standings: standings(),
      updatedAt: new Date("2026-06-24T21:00:00.000Z"),
      timeZone: "America/Sao_Paulo",
      renderError: "sharp failed"
    });

    expect(message.content).toContain("Dashboard image render failed: sharp failed");
    expect(message.content).toContain(" # Grp Team");
    expect(message.content).toContain("avança");
    expect(message.files).toEqual([]);
  });
});

function standings(): ThirdPlaceStandings {
  return {
    status: "resolved",
    rows: [
      {
        thirdPlaceRank: 1,
        qualificationState: "advancing",
        rank: 3,
        group: "A",
        teamCode: "MEX",
        teamName: "Mexico",
        played: 3,
        wins: 1,
        draws: 1,
        losses: 1,
        goalsFor: 4,
        goalsAgainst: 3,
        goalDifference: 1,
        points: 4,
        tiebreakerStatus: "resolved"
      }
    ]
  };
}
