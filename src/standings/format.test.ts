import { describe, expect, test } from "vitest";
import { Buffer } from "node:buffer";

import { createStandingsDashboardMessages } from "./format.js";
import { computeGroupStandings } from "./standings.js";
import type { StoredResult } from "../storage/database.js";
import { WORLD_CUP_2026_SEED } from "../worldcup/seed.js";

describe("createStandingsDashboardMessages", () => {
  test("renders two dashboard messages split into groups A-F and G-L", () => {
    const messages = createStandingsDashboardMessages({
      standings: computeGroupStandings(WORLD_CUP_2026_SEED.matches, []),
      updatedAt: new Date("2026-06-11T23:30:00.000Z"),
      timeZone: "UTC"
    });

    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({
      key: "groups_a_f",
      content: expect.stringContaining("World Cup 2026 Group Standings")
    });
    expect(messages[1]).toMatchObject({
      key: "groups_g_l",
      content: expect.stringContaining("World Cup 2026 Group Standings")
    });
    expect(messages[0]?.embeds).toEqual([]);
    expect(messages[1]?.embeds).toEqual([]);
    expect(messages[0]?.files).toEqual([]);
    expect(messages[1]?.files).toEqual([]);
    expect(messages[0]?.content).toContain("GROUP A");
    expect(messages[0]?.content).toContain("GROUP F");
    expect(messages[1]?.content).toContain("GROUP L");
    expect(messages[0]?.content).toContain("Updated: 2026-06-11 23:30 UTC");
  });

  test("renders a full-width ASCII table with three group columns per band", () => {
    const messages = createStandingsDashboardMessages({
      standings: computeGroupStandings(WORLD_CUP_2026_SEED.matches, [
        result("wc2026-001", 2, 1)
      ]),
      updatedAt: new Date("2026-06-11T23:30:00.000Z"),
      timeZone: "UTC"
    });
    const content = messages[0]?.content;

    expect(content).toContain("Grupos A-F");
    expect(content).toContain("```text");
    expect(content).toContain("+------------------------+------------------------+------------------------+");
    expect(content).toContain("| GROUP A                | GROUP B                | GROUP C                |");
    expect(content).toContain("México");
    expect(content).toContain("África do Sul");
    expect(content).toContain("Bósnia e Herz.");
    expect(content).toContain("Brasil");
    expect(content).not.toContain("| MEX  3");
    expect(content).not.toContain("| RSA  0");
    expect(content).toContain("| GROUP D                | GROUP E                | GROUP F                |");
    expect(content).toContain("Columns: TEAM PTS GD");
  });

  test("renders public image messages when standings PNGs are available", () => {
    const groupsAF = Buffer.from("groups-a-f");
    const groupsGL = Buffer.from("groups-g-l");
    const messages = createStandingsDashboardMessages({
      standings: computeGroupStandings(WORLD_CUP_2026_SEED.matches, []),
      updatedAt: new Date("2026-06-11T23:30:00.000Z"),
      timeZone: "UTC",
      pngByKey: new Map([
        ["groups_a_f", groupsAF],
        ["groups_g_l", groupsGL]
      ])
    });

    expect(messages[0]).toMatchObject({
      key: "groups_a_f",
      content: [
        "**Copa do Mundo 2026 - Grupos A-F**",
        "Atualizado: 2026-06-11 23:30 UTC",
        "Imagem atualizada.",
        "Football data provided by the Football-Data.org API."
      ].join("\n"),
      embeds: [],
      files: [{ attachment: groupsAF, name: "copanalhas-standings-groups-a-f.png" }]
    });
    expect(messages[1]?.files).toEqual([
      { attachment: groupsGL, name: "copanalhas-standings-groups-g-l.png" }
    ]);
    expect(messages[0]?.content).not.toContain("```text");
  });

  test("keeps a text fallback when standings image rendering is unavailable", () => {
    const messages = createStandingsDashboardMessages({
      standings: computeGroupStandings(WORLD_CUP_2026_SEED.matches, []),
      updatedAt: new Date("2026-06-11T23:30:00.000Z"),
      timeZone: "UTC",
      renderErrors: new Map([["groups_a_f", "sharp failed"]])
    });

    expect(messages[0]?.files).toEqual([]);
    expect(messages[0]?.content).toContain("Dashboard image render failed: sharp failed");
    expect(messages[0]?.content).toContain("```text");
    expect(messages[0]?.content).toContain("GROUP A");
  });
});

function result(matchId: string, homeScore: number, awayScore: number): StoredResult {
  return {
    matchId,
    homeScore,
    awayScore,
    recordedAt: "2026-06-11T23:00:00.000Z",
    resultSource: "manual",
    externalMatchId: null,
    fetchedAt: null
  };
}
