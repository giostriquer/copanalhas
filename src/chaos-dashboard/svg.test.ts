import { describe, expect, test } from "vitest";

import { renderChaosDashboardSvg } from "./svg.js";
import { sampleChaosDashboardModel } from "./test-helpers.js";

describe("chaos dashboard SVG renderer", () => {
  test("renders the main sections and evidence labels", () => {
    const svg = renderChaosDashboardSvg(sampleChaosDashboardModel());

    expect(svg).toContain("<svg");
    expect(svg).toContain("Copanalhas Recap");
    expect(svg).toContain('fill="#002776"');
    expect(svg).toContain('fill="#FFDF00"');
    expect(svg).toContain("Genios e Copazus");
    expect(svg).toContain("Highlights");
    expect(svg).toContain("Lider da Semana");
    expect(svg).toContain("Guibexa");
    expect(svg).toContain('href="data:image/png;base64,leader-avatar"');
    expect(svg).toContain("Profeta isolado");
    expect(svg).toContain("Consenso burro");
    expect(svg).toContain("Solo");
    expect(svg).toContain("Exato");
    expect(svg).toContain("Resultado");
    expect(svg).toContain("Perto");
    expect(svg).not.toContain("#  Pts  S  E  R  P   Jogador");
    expect(svg).not.toContain("Premios da Zoacao");
    expect(svg).not.toContain("Caos dos Jogos");
    expect(svg).not.toContain("Zoeira estatistica");
  });

  test("wraps award subtitles without colliding with value text", () => {
    const svg = renderChaosDashboardSvg(sampleChaosDashboardModel());

    expect(svg).toContain("Cravou sozinho e deixou a");
    expect(svg).toContain("mesa olhando torto.");
    expect(svg).not.toContain("Cravou sozinho e deixou a m.");

    const valueY = textY(svg, "2 no consenso errado");
    const subtitleY = textY(svg, "A democracia produziu uma derrota coletiva.");

    expect(subtitleY - valueY).toBeGreaterThanOrEqual(18);
  });

  test("renders the leader of the week as a spacious profile card with aligned stat chips", () => {
    const svg = renderChaosDashboardSvg(
      sampleChaosDashboardModel({
        leaderboardTop: [],
        peopleAwards: [],
        matchAwards: [],
        leaderOfWeek: {
          userId: "leader",
          displayName: "Pessoa Central",
          points: 23,
          soloCount: 1,
          exactCount: 4,
          outcomeCount: 3,
          closestCount: 0,
          avatarDataUri: "data:image/png;base64,leader-avatar"
        }
      })
    );

    expect(svg).toContain('height="152"');
    expect(svg).toContain("Pessoa Central");
    expect(svg).toContain("Solo 1");
    expect(svg).toContain("Exato 4");
    expect(svg).toContain("Resultado 3");
    expect(svg).toContain("Perto 0");
    expect(svg).not.toContain("Solo 1   Exato 4");
    expect(svg).not.toContain("Resultado 3   Perto 0");

    const titleY = textY(svg, "Lider da Semana");
    const pointsY = textY(svg, "23 pts");
    const soloY = textY(svg, "Solo 1");

    expect(pointsY - titleY).toBeGreaterThanOrEqual(48);
    expect(soloY - pointsY).toBeGreaterThanOrEqual(28);
  });

  test("escapes user and match text before writing SVG", () => {
    const model = sampleChaosDashboardModel({
      leaderboardTop: [
        {
          userId: "user-a",
          displayName: "Nome <perigoso>",
          rank: 1,
          points: 5,
          soloCount: 1,
          exactCount: 0,
          outcomeCount: 0,
          closestCount: 0,
          matchesScored: 1
        }
      ]
    });

    expect(renderChaosDashboardSvg(model)).toContain("Nome &lt;perigoso&gt;");
  });
});

function textY(svg: string, value: string): number {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const match = new RegExp(`<text[^>]* y="([0-9]+)"[^>]*>${escaped}</text>`, "u").exec(svg);

  if (!match?.[1]) {
    throw new Error(`Could not find text node for ${value}`);
  }

  return Number(match[1]);
}
