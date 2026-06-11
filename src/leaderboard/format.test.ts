import { describe, expect, test } from "vitest";

import { createLeaderboardDashboardMessage, formatLeaderboard } from "./format.js";

describe("formatLeaderboard", () => {
  test("renders no-results output", () => {
    expect(formatLeaderboard([])).toBe(
      [
        "Ranking Copanalhas",
        "Ainda não há resultados pontuados.",
        "",
        "Como funciona",
        "- Envie seu palpite pelo botão do jogo do dia; você pode editar até 30 min antes da partida.",
        "- Se só uma pessoa acertar o placar exato, ela ganha 3 pts.",
        "- Se mais de uma pessoa acertar o placar exato, cada uma ganha 1 pt.",
        "- O ponto de mais próximo só vale quando ninguém acerta o placar exato.",
        "- Nesse caso, ganha 1 pt quem tiver a menor soma de diferenças nos gols dos dois times; empates recebem 1 pt cada.",
        "",
        "Premiação",
        "- 1000 (da pra aumentar se alguem quiser contribuir)",
        "- Primeiro lugar = 60%",
        "- Segundo lugar = 30%",
        "- Terceiro lugar = 10%",
        "",
        "Football data provided by the Football-Data.org API."
      ].join("\n")
    );
  });

  test("renders ranked leaderboard rows with display names", () => {
    expect(
      formatLeaderboard(
        [
          { userId: "u1", points: 4, exactCount: 1, closestCount: 1, matchesScored: 2 },
          { userId: "u2", points: 1, exactCount: 0, closestCount: 1, matchesScored: 1 }
        ],
        new Map([
          ["u1", "Alice"],
          ["u2", "Bob"]
        ])
      )
    ).toBe(
      [
        "Ranking Copanalhas",
        "1. Alice - 4 pts (1 exato, 1 mais próximo, 2 partidas)",
        "2. Bob - 1 pt (0 exatos, 1 mais próximo, 1 partida)",
        "",
        "Como funciona",
        "- Envie seu palpite pelo botão do jogo do dia; você pode editar até 30 min antes da partida.",
        "- Se só uma pessoa acertar o placar exato, ela ganha 3 pts.",
        "- Se mais de uma pessoa acertar o placar exato, cada uma ganha 1 pt.",
        "- O ponto de mais próximo só vale quando ninguém acerta o placar exato.",
        "- Nesse caso, ganha 1 pt quem tiver a menor soma de diferenças nos gols dos dois times; empates recebem 1 pt cada.",
        "",
        "Premiação",
        "- 1000 (da pra aumentar se alguem quiser contribuir)",
        "- Primeiro lugar = 60%",
        "- Segundo lugar = 30%",
        "- Terceiro lugar = 10%",
        "",
        "Football data provided by the Football-Data.org API."
      ].join("\n")
    );
  });

  test("uses shared ranks for tied scores", () => {
    expect(
      formatLeaderboard([
        { userId: "u1", points: 3, exactCount: 1, closestCount: 0, matchesScored: 1 },
        { userId: "u2", points: 1, exactCount: 0, closestCount: 1, matchesScored: 1 },
        { userId: "u3", points: 1, exactCount: 0, closestCount: 1, matchesScored: 1 }
      ])
    ).toBe(
      [
        "Ranking Copanalhas",
        "1. u1 - 3 pts (1 exato, 0 mais próximos, 1 partida)",
        "2. u2 - 1 pt (0 exatos, 1 mais próximo, 1 partida)",
        "2. u3 - 1 pt (0 exatos, 1 mais próximo, 1 partida)",
        "",
        "Como funciona",
        "- Envie seu palpite pelo botão do jogo do dia; você pode editar até 30 min antes da partida.",
        "- Se só uma pessoa acertar o placar exato, ela ganha 3 pts.",
        "- Se mais de uma pessoa acertar o placar exato, cada uma ganha 1 pt.",
        "- O ponto de mais próximo só vale quando ninguém acerta o placar exato.",
        "- Nesse caso, ganha 1 pt quem tiver a menor soma de diferenças nos gols dos dois times; empates recebem 1 pt cada.",
        "",
        "Premiação",
        "- 1000 (da pra aumentar se alguem quiser contribuir)",
        "- Primeiro lugar = 60%",
        "- Segundo lugar = 30%",
        "- Terceiro lugar = 10%",
        "",
        "Football data provided by the Football-Data.org API."
      ].join("\n")
    );
  });

  test("normalizes display names before rendering them", () => {
    const output = formatLeaderboard(
      [{ userId: "u1", points: 0, exactCount: 0, closestCount: 0, matchesScored: 0 }],
      new Map([["u1", "Ana\nMaria"]])
    );

    expect(output).toContain("1. Ana Maria - 0 pts");
    expect(output).not.toContain("Ana\nMaria");
  });

  test("renders prize guidance before Football-Data attribution", () => {
    const output = formatLeaderboard([]);

    expect(output).toContain(
      [
        "Premiação",
        "- 1000 (da pra aumentar se alguem quiser contribuir)",
        "- Primeiro lugar = 60%",
        "- Segundo lugar = 30%",
        "- Terceiro lugar = 10%",
        "",
        "Football data provided by the Football-Data.org API."
      ].join("\n")
    );
  });
});

describe("createLeaderboardDashboardMessage", () => {
  test("renders an empty public dashboard message", () => {
    expect(
      createLeaderboardDashboardMessage({
        rows: [],
        updatedAt: new Date("2026-06-11T23:30:00.000Z"),
        timeZone: "UTC"
      })
    ).toEqual({
      content: [
        "Ranking Copanalhas",
        "Atualizado: 2026-06-11 23:30 UTC",
        "```text",
        "Ainda não há partidas pontuadas.",
        "```",
        "",
        "Como funciona",
        "- Envie seu palpite pelo botão do jogo do dia; você pode editar até 30 min antes da partida.",
        "- Se só uma pessoa acertar o placar exato, ela ganha 3 pts.",
        "- Se mais de uma pessoa acertar o placar exato, cada uma ganha 1 pt.",
        "- O ponto de mais próximo só vale quando ninguém acerta o placar exato.",
        "- Nesse caso, ganha 1 pt quem tiver a menor soma de diferenças nos gols dos dois times; empates recebem 1 pt cada.",
        "",
        "Premiação",
        "- 1000 (da pra aumentar se alguem quiser contribuir)",
        "- Primeiro lugar = 60%",
        "- Segundo lugar = 30%",
        "- Terceiro lugar = 10%",
        "",
        "Football data provided by the Football-Data.org API."
      ].join("\n"),
      embeds: []
    });
  });

  test("includes visible Football-Data attribution in the public dashboard", () => {
    const message = createLeaderboardDashboardMessage({
      rows: [],
      updatedAt: new Date("2026-06-11T23:30:00.000Z"),
      timeZone: "UTC"
    });

    expect(message.content).toContain("Football data provided by the Football-Data.org API");
  });

  test("renders ranked player rows in a compact table", () => {
    expect(
      createLeaderboardDashboardMessage({
        rows: [
          {
            userId: "user-1",
            points: 6,
            exactCount: 2,
            closestCount: 0,
            matchesScored: 2
          },
          {
            userId: "user-2",
            points: 1,
            exactCount: 0,
            closestCount: 1,
            matchesScored: 2
          }
        ],
        displayNames: new Map([
          ["user-1", "Giova"],
          ["user-2", "Ana"]
        ]),
        updatedAt: new Date("2026-06-11T23:30:00.000Z"),
        timeZone: "UTC"
      }).content
    ).toBe(
      [
        "Ranking Copanalhas",
        "Atualizado: 2026-06-11 23:30 UTC",
        "```text",
        "#  Pts Exato Perto Jogos  Jogador",
        "1    6     2     0     2  Giova",
        "2    1     0     1     2  Ana",
        "```",
        "",
        "Como funciona",
        "- Envie seu palpite pelo botão do jogo do dia; você pode editar até 30 min antes da partida.",
        "- Se só uma pessoa acertar o placar exato, ela ganha 3 pts.",
        "- Se mais de uma pessoa acertar o placar exato, cada uma ganha 1 pt.",
        "- O ponto de mais próximo só vale quando ninguém acerta o placar exato.",
        "- Nesse caso, ganha 1 pt quem tiver a menor soma de diferenças nos gols dos dois times; empates recebem 1 pt cada.",
        "",
        "Premiação",
        "- 1000 (da pra aumentar se alguem quiser contribuir)",
        "- Primeiro lugar = 60%",
        "- Segundo lugar = 30%",
        "- Terceiro lugar = 10%",
        "",
        "Football data provided by the Football-Data.org API."
      ].join("\n")
    );
  });

  test("normalizes dashboard display names before placing them in the table", () => {
    const content = createLeaderboardDashboardMessage({
      rows: [{ userId: "user-1", points: 0, exactCount: 0, closestCount: 0, matchesScored: 0 }],
      displayNames: new Map([["user-1", "Ana\nMaria"]]),
      updatedAt: new Date("2026-06-11T23:30:00.000Z"),
      timeZone: "UTC"
    }).content;

    expect(content).toContain("1    0     0     0     0  Ana Maria");
    expect(content).not.toContain("Ana\nMaria");
  });

  test("keeps numeric columns aligned before long display names", () => {
    const content = createLeaderboardDashboardMessage({
      rows: [
        { userId: "user-1", points: 0, exactCount: 0, closestCount: 0, matchesScored: 0 },
        { userId: "user-2", points: 0, exactCount: 0, closestCount: 0, matchesScored: 0 }
      ],
      displayNames: new Map([
        ["user-1", "Anguishx"],
        ["user-2", "QUINZE DIASFIPS"]
      ]),
      updatedAt: new Date("2026-06-11T23:30:00.000Z"),
      timeZone: "UTC"
    }).content;

    expect(content).toContain(
      ["#  Pts Exato Perto Jogos  Jogador", "1    0     0     0     0  Anguishx"].join("\n")
    );
    expect(content).toContain("1    0     0     0     0  QUINZE DIASFIPS");
  });
});
