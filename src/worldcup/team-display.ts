export interface TeamDisplayInput {
  code: string;
  name: string;
}

const ptBrTeamNames = new Map<string, string>([
  ["ALG", "Argélia"],
  ["ARG", "Argentina"],
  ["AUS", "Austrália"],
  ["AUT", "Áustria"],
  ["BEL", "Bélgica"],
  ["BIH", "Bósnia e Herzegovina"],
  ["BRA", "Brasil"],
  ["CAN", "Canadá"],
  ["CIV", "Costa do Marfim"],
  ["COD", "RD Congo"],
  ["COL", "Colômbia"],
  ["CPV", "Cabo Verde"],
  ["CRO", "Croácia"],
  ["CUW", "Curaçao"],
  ["CZE", "Tchéquia"],
  ["ECU", "Equador"],
  ["EGY", "Egito"],
  ["ENG", "Inglaterra"],
  ["ESP", "Espanha"],
  ["FRA", "França"],
  ["GER", "Alemanha"],
  ["GHA", "Gana"],
  ["HAI", "Haiti"],
  ["IRN", "Irã"],
  ["IRQ", "Iraque"],
  ["JOR", "Jordânia"],
  ["JPN", "Japão"],
  ["KOR", "Coreia do Sul"],
  ["KSA", "Arábia Saudita"],
  ["MAR", "Marrocos"],
  ["MEX", "México"],
  ["NED", "Holanda"],
  ["NOR", "Noruega"],
  ["NZL", "Nova Zelândia"],
  ["PAN", "Panamá"],
  ["PAR", "Paraguai"],
  ["POR", "Portugal"],
  ["QAT", "Catar"],
  ["RSA", "África do Sul"],
  ["SCO", "Escócia"],
  ["SEN", "Senegal"],
  ["SUI", "Suíça"],
  ["SWE", "Suécia"],
  ["TUN", "Tunísia"],
  ["TUR", "Turquia"],
  ["URU", "Uruguai"],
  ["USA", "Estados Unidos"],
  ["UZB", "Uzbequistão"]
]);

const compactPtBrTeamNames = new Map<string, string>([
  ["BIH", "Bósnia e Herz."],
  ["CIV", "Costa Marfim"]
]);

export function formatTeamName(team: TeamDisplayInput): string {
  return ptBrTeamNames.get(team.code) ?? team.name;
}

export function formatCompactTeamName(team: TeamDisplayInput, maxLength: number): string {
  const readableName = compactPtBrTeamNames.get(team.code) ?? formatTeamName(team);

  if (readableName.length <= maxLength) {
    return readableName;
  }

  return `${readableName.slice(0, maxLength - 1)}.`;
}
