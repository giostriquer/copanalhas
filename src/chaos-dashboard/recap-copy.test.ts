import { describe, expect, test } from "vitest";

import { applyChaosRecapCopyArtifact } from "./recap-copy.js";
import type { ChaosPeopleAward } from "./types.js";

describe("chaos recap copy artifacts", () => {
  test("applies generated titles and subtitles without changing deterministic award data", () => {
    const result = applyChaosRecapCopyArtifact(
      awards(),
      {
        version: 1,
        periodKey: "group-week-1",
        cards: [
          {
            key: "profeta-isolado",
            title: "Oraculo do Zap",
            subtitle: "Transformou dado bom em zoeira auditavel."
          },
          {
            key: "quase-inteligente",
            title: "Calculadora Emocional",
            subtitle: "Errou pouco o bastante para virar personagem."
          }
        ]
      },
      "group-week-1"
    );

    expect(result.state).toBe("applied");
    expect(result.appliedCount).toBe(2);
    expect(result.awards).toEqual([
      {
        key: "profeta-isolado",
        title: "Oraculo do Zap",
        subject: "Guibexa",
        value: "2 solos",
        subtitle: "Transformou dado bom em zoeira auditavel."
      },
      {
        key: "quase-inteligente",
        title: "Calculadora Emocional",
        subject: "Anghexa",
        value: "3 pertos",
        subtitle: "Errou pouco o bastante para virar personagem."
      }
    ]);
  });

  test("falls back to deterministic awards when the artifact is for another period", () => {
    const original = awards();
    const result = applyChaosRecapCopyArtifact(
      original,
      {
        version: 1,
        periodKey: "group-week-2",
        cards: [
          {
            key: "profeta-isolado",
            title: "Nao deveria entrar",
            subtitle: "Periodo errado."
          }
        ]
      },
      "group-week-1"
    );

    expect(result.state).toBe("fallback");
    expect(result.error).toContain("periodKey");
    expect(result.awards).toEqual(original);
  });

  test("falls back when generated copy contains Discord mentions", () => {
    const result = applyChaosRecapCopyArtifact(
      awards(),
      {
        version: 1,
        periodKey: "group-week-1",
        cards: [
          {
            key: "profeta-isolado",
            title: "@everyone olha aqui",
            subtitle: "Nao pode disparar mencao no painel."
          }
        ]
      },
      "group-week-1"
    );

    expect(result.state).toBe("fallback");
    expect(result.error).toContain("mention");
  });
});

function awards(): ChaosPeopleAward[] {
  return [
    {
      key: "profeta-isolado",
      title: "Profeta isolado",
      subject: "Guibexa",
      value: "2 solos",
      subtitle: "Cravou sozinho e deixou a mesa olhando torto."
    },
    {
      key: "quase-inteligente",
      title: "Quase inteligente",
      subject: "Anghexa",
      value: "3 pertos",
      subtitle: "Errou com conviccao estatisticamente aceitavel."
    }
  ];
}
