import { describe, expect, test } from "vitest";

import { renderChaosDashboardSvg } from "./svg.js";
import { sampleChaosDashboardModel } from "./test-helpers.js";

describe("chaos dashboard SVG renderer", () => {
  test("renders the main sections and evidence labels", () => {
    const svg = renderChaosDashboardSvg(sampleChaosDashboardModel());

    expect(svg).toContain("<svg");
    expect(svg).toContain("Copanalhas Recap");
    expect(svg).toContain("Premios da Zoacao");
    expect(svg).toContain("Caos dos Jogos");
    expect(svg).toContain("Guibexa");
    expect(svg).toContain("Profeta isolado");
    expect(svg).toContain("Consenso burro");
    expect(svg).toContain("Zoeira estatistica");
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
