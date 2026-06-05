import { describe, expect, test } from "vitest";

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
      content: expect.stringContaining("Groups A-F")
    });
    expect(messages[1]).toMatchObject({
      key: "groups_g_l",
      content: expect.stringContaining("Groups G-L")
    });
    expect(messages[0]?.embeds).toHaveLength(6);
    expect(messages[1]?.embeds).toHaveLength(6);
    expect(messages[0]?.content).toContain("Updated: 2026-06-11 23:30 UTC");
  });

  test("renders compact group table rows with points and goal records", () => {
    const messages = createStandingsDashboardMessages({
      standings: computeGroupStandings(WORLD_CUP_2026_SEED.matches, [
        result("wc2026-001", 2, 1)
      ]),
      updatedAt: new Date("2026-06-11T23:30:00.000Z"),
      timeZone: "UTC"
    });
    const groupA = messages[0]?.embeds.find((embed) => embed.title === "Group A");

    expect(groupA?.description).toContain("```text");
    expect(groupA?.description).toContain("# Team");
    expect(groupA?.description).toContain("Pts");
    expect(groupA?.description).toContain("1 Mexico");
    expect(groupA?.description).toContain("1 1 0 0  2  1  1   3");
    expect(groupA?.description).toContain("4 South Africa");
    expect(groupA?.description).toContain("1 0 0 1  1  2 -1   0");
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
