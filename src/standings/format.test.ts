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
      content: expect.stringContaining("World Cup 2026 Group Standings")
    });
    expect(messages[1]).toMatchObject({
      key: "groups_g_l",
      content: expect.stringContaining("World Cup 2026 Group Standings")
    });
    expect(messages[0]?.content).not.toContain("Groups A-F");
    expect(messages[1]?.content).not.toContain("Groups G-L");
    expect(messages[0]?.embeds).toHaveLength(1);
    expect(messages[1]?.embeds).toHaveLength(1);
    expect(messages[0]?.embeds[0]).toMatchObject({
      title: "Groups A-F",
      fields: expect.arrayContaining([
        expect.objectContaining({
          name: "Group A",
          inline: true
        }),
        expect.objectContaining({
          name: "Group F",
          inline: true
        })
      ])
    });
    expect(messages[0]?.embeds[0]?.fields).toHaveLength(6);
    expect(messages[1]?.embeds[0]).toMatchObject({
      title: "Groups G-L"
    });
    expect(messages[1]?.embeds[0]?.fields).toHaveLength(6);
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
    const groupA = messages[0]?.embeds[0]?.fields?.find((field) => field.name === "Group A");

    expect(groupA?.inline).toBe(true);
    expect(groupA?.value).toContain("```text");
    expect(groupA?.value).toContain("# Team P W D L GD Pts");
    expect(groupA?.value).toContain("1 MEX");
    expect(groupA?.value).toContain("1 MEX 1 1 0 0 +1 3");
    expect(groupA?.value).toContain("4 RSA");
    expect(groupA?.value).toContain("4 RSA 1 0 0 1 -1 0");
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
