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
        "- Se só uma pessoa acertar o placar exato, ela ganha 5 pts solo.",
        "- Se mais de uma pessoa acertar o placar exato, cada uma ganha 3 pts exato.",
        "- Se ninguém acertar o placar exato, quem acertar o vencedor ou empate ganha 2 pts resultado.",
        "- O ponto de mais próximo só vale quando ninguém acerta o placar exato nem o vencedor/empate.",
        "- Nesse caso, ganha 1 pt quem tiver a menor soma de diferenças nos gols dos dois times; se empatar, desempata pelo total de gols mais próximo.",
        "- Em empate na pontuação, desempata por solo, exatos, resultados, mais próximos e depois ID do jogador.",
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
          { userId: "u1", points: 9, soloCount: 1, exactCount: 1, outcomeCount: 0, closestCount: 1, matchesScored: 3 },
          { userId: "u2", points: 2, soloCount: 0, exactCount: 0, outcomeCount: 1, closestCount: 0, matchesScored: 1 }
        ],
        new Map([
          ["u1", "Alice"],
          ["u2", "Bob"]
        ])
      )
    ).toBe(
      [
        "Ranking Copanalhas",
        "1. Alice - 9 pts (1 solo, 1 exato, 0 resultados, 1 mais próximo, 3 partidas)",
        "2. Bob - 2 pts (0 solos, 0 exatos, 1 resultado, 0 mais próximos, 1 partida)",
        "",
        "Como funciona",
        "- Envie seu palpite pelo botão do jogo do dia; você pode editar até 30 min antes da partida.",
        "- Se só uma pessoa acertar o placar exato, ela ganha 5 pts solo.",
        "- Se mais de uma pessoa acertar o placar exato, cada uma ganha 3 pts exato.",
        "- Se ninguém acertar o placar exato, quem acertar o vencedor ou empate ganha 2 pts resultado.",
        "- O ponto de mais próximo só vale quando ninguém acerta o placar exato nem o vencedor/empate.",
        "- Nesse caso, ganha 1 pt quem tiver a menor soma de diferenças nos gols dos dois times; se empatar, desempata pelo total de gols mais próximo.",
        "- Em empate na pontuação, desempata por solo, exatos, resultados, mais próximos e depois ID do jogador.",
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
        { userId: "u1", points: 5, soloCount: 1, exactCount: 0, outcomeCount: 0, closestCount: 0, matchesScored: 1 },
        { userId: "u2", points: 2, soloCount: 0, exactCount: 0, outcomeCount: 1, closestCount: 0, matchesScored: 1 },
        { userId: "u3", points: 2, soloCount: 0, exactCount: 0, outcomeCount: 1, closestCount: 0, matchesScored: 1 },
        { userId: "u4", points: 1, soloCount: 0, exactCount: 0, outcomeCount: 0, closestCount: 1, matchesScored: 1 }
      ])
    ).toBe(
      [
        "Ranking Copanalhas",
        "1. u1 - 5 pts (1 solo, 0 exatos, 0 resultados, 0 mais próximos, 1 partida)",
        "2. u2 - 2 pts (0 solos, 0 exatos, 1 resultado, 0 mais próximos, 1 partida)",
        "2. u3 - 2 pts (0 solos, 0 exatos, 1 resultado, 0 mais próximos, 1 partida)",
        "4. u4 - 1 pt (0 solos, 0 exatos, 0 resultados, 1 mais próximo, 1 partida)",
        "",
        "Como funciona",
        "- Envie seu palpite pelo botão do jogo do dia; você pode editar até 30 min antes da partida.",
        "- Se só uma pessoa acertar o placar exato, ela ganha 5 pts solo.",
        "- Se mais de uma pessoa acertar o placar exato, cada uma ganha 3 pts exato.",
        "- Se ninguém acertar o placar exato, quem acertar o vencedor ou empate ganha 2 pts resultado.",
        "- O ponto de mais próximo só vale quando ninguém acerta o placar exato nem o vencedor/empate.",
        "- Nesse caso, ganha 1 pt quem tiver a menor soma de diferenças nos gols dos dois times; se empatar, desempata pelo total de gols mais próximo.",
        "- Em empate na pontuação, desempata por solo, exatos, resultados, mais próximos e depois ID do jogador.",
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
      [{ userId: "u1", points: 0, soloCount: 0, exactCount: 0, outcomeCount: 0, closestCount: 0, matchesScored: 0 }],
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
        "- Se só uma pessoa acertar o placar exato, ela ganha 5 pts solo.",
        "- Se mais de uma pessoa acertar o placar exato, cada uma ganha 3 pts exato.",
        "- Se ninguém acertar o placar exato, quem acertar o vencedor ou empate ganha 2 pts resultado.",
        "- O ponto de mais próximo só vale quando ninguém acerta o placar exato nem o vencedor/empate.",
        "- Nesse caso, ganha 1 pt quem tiver a menor soma de diferenças nos gols dos dois times; se empatar, desempata pelo total de gols mais próximo.",
        "- Em empate na pontuação, desempata por solo, exatos, resultados, mais próximos e depois ID do jogador.",
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
            points: 10,
            soloCount: 2,
            exactCount: 0,
            outcomeCount: 0,
            closestCount: 0,
            matchesScored: 2
          },
          {
            userId: "user-2",
            points: 2,
            soloCount: 0,
            exactCount: 0,
            outcomeCount: 1,
            closestCount: 0,
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
        "#  Pts Solo Exato Resul Perto Jogos  Jogador",
        "1   10    2     0     0     0     2  Giova",
        "2    2    0     0     1     0     2  Ana",
        "```",
        "",
        "Como funciona",
        "- Envie seu palpite pelo botão do jogo do dia; você pode editar até 30 min antes da partida.",
        "- Se só uma pessoa acertar o placar exato, ela ganha 5 pts solo.",
        "- Se mais de uma pessoa acertar o placar exato, cada uma ganha 3 pts exato.",
        "- Se ninguém acertar o placar exato, quem acertar o vencedor ou empate ganha 2 pts resultado.",
        "- O ponto de mais próximo só vale quando ninguém acerta o placar exato nem o vencedor/empate.",
        "- Nesse caso, ganha 1 pt quem tiver a menor soma de diferenças nos gols dos dois times; se empatar, desempata pelo total de gols mais próximo.",
        "- Em empate na pontuação, desempata por solo, exatos, resultados, mais próximos e depois ID do jogador.",
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
      rows: [{ userId: "user-1", points: 0, soloCount: 0, exactCount: 0, outcomeCount: 0, closestCount: 0, matchesScored: 0 }],
      displayNames: new Map([["user-1", "Ana\nMaria"]]),
      updatedAt: new Date("2026-06-11T23:30:00.000Z"),
      timeZone: "UTC"
    }).content;

    expect(content).toContain("1    0    0     0     0     0     0  Ana Maria");
    expect(content).not.toContain("Ana\nMaria");
  });

  test("keeps numeric columns aligned before long display names", () => {
    const content = createLeaderboardDashboardMessage({
      rows: [
        { userId: "user-1", points: 0, soloCount: 0, exactCount: 0, outcomeCount: 0, closestCount: 0, matchesScored: 0 },
        { userId: "user-2", points: 0, soloCount: 0, exactCount: 0, outcomeCount: 0, closestCount: 0, matchesScored: 0 }
      ],
      displayNames: new Map([
        ["user-1", "Anguishx"],
        ["user-2", "QUINZE DIASFIPS"]
      ]),
      updatedAt: new Date("2026-06-11T23:30:00.000Z"),
      timeZone: "UTC"
    }).content;

    expect(content).toContain(
      ["#  Pts Solo Exato Resul Perto Jogos  Jogador", "1    0    0     0     0     0     0  Anguishx"].join("\n")
    );
    expect(content).toContain("1    0    0     0     0     0     0  QUINZE DIASFIPS");
  });
});
