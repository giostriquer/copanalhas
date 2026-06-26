import { describe, expect, test } from "vitest";

import { renderLeaderboardDashboardSvg } from "./svg.js";

describe("renderLeaderboardDashboardSvg", () => {
  test("renders the full leaderboard table with Brazilian visual tokens", () => {
    const svg = renderLeaderboardDashboardSvg({
      rows: [
        {
          userId: "user-1",
          points: 23,
          soloCount: 1,
          exactCount: 4,
          outcomeCount: 3,
          closestCount: 0,
          decisionBonusCount: 1,
          matchesScored: 8
        },
        {
          userId: "user-2",
          points: 9,
          soloCount: 0,
          exactCount: 3,
          outcomeCount: 0,
          closestCount: 0,
          decisionBonusCount: 0,
          matchesScored: 3
        }
      ],
      displayNames: new Map([
        ["user-1", "Giova"],
        ["user-2", "Ana"]
      ]),
      avatarDataUris: new Map([["user-1", "data:image/png;base64,avatar-one"]]),
      generatedAtLabel: "2026-06-11 23:30 UTC"
    });

    expect(svg).toContain("<svg");
    expect(svg).toContain("Ranking Copanalhas");
    expect(svg).toContain("Tabela geral");
    expect(svg).toContain("2026-06-11 23:30 UTC");
    expect(svg).toContain("Giova");
    expect(svg).toContain("Ana");
    expect(svg).toContain("Solo");
    expect(svg).toContain("Exato");
    expect(svg).toContain("Resultado");
    expect(svg).toContain("Perto");
    expect(svg).toContain("Bonus");
    expect(svg).toContain("Jogos");
    expect(svg).toContain("Método +2 pts");
    expect(svg).toContain('aria-label="Bandeira do Brasil"');
    expect(svg).toContain('id="leaderboard-avatar-user-1"');
    expect(svg).toContain('href="data:image/png;base64,avatar-one"');
    expect(svg).toContain('x="1414"');
    expect(svg).not.toContain('x="1464"');
    expect(svg).toContain("Premiação: 1k");
    expect(svg).toContain("PS: Se o anguish ganhar eu darei unblock nele como premiação no lugar dos 60%.");
    expect(svg).toContain("#FFDF00");
    expect(svg).toContain("#002776");
    expect(svg).not.toContain(">Resul<");
  });

  test("escapes user display names before writing SVG text", () => {
    const svg = renderLeaderboardDashboardSvg({
      rows: [
        {
          userId: "user-1",
          points: 1,
          soloCount: 0,
          exactCount: 0,
          outcomeCount: 0,
          closestCount: 1,
          decisionBonusCount: 0,
          matchesScored: 1
        }
      ],
      displayNames: new Map([["user-1", "Ana <perigosa> & Bob"]]),
      generatedAtLabel: "2026-06-11 23:30 UTC"
    });

    expect(svg).toContain("Ana &lt;perigosa&gt; &amp; Bob");
    expect(svg).not.toContain("Ana <perigosa> & Bob");
  });
});
