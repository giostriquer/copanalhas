import type { BracketEntrant, BracketMatch, BracketState } from "./types.js";
import { renderReferenceBracketSvg } from "./svg-renderer.js";
import { formatTeamName } from "../worldcup/team-display.js";

export interface RenderBracketSvgOptions {
  title?: string;
}

const FOOTBALL_DATA_ATTRIBUTION = "Football data provided by the Football-Data.org API.";
const marginX = 56;
const headerHeight = 140;
const footerHeight = 58;
const sideWidth = 520;
const sideGap = 72;
const matchHeight = 112;
const matchGap = 10;
const pairGap = 22;
const entrantGap = 34;
const matchPaddingX = 18;
const flagWidth = 34;
const flagHeight = 22;
const flagGap = 10;

const bracketSides: readonly BracketSide[] = [
  {
    key: "left",
    label: "Lado esquerdo",
    subtitle: "16 seleções, caminho para a semifinal #101",
    pairs: [
      { nextMatchNumber: 89, matchNumbers: [74, 77] },
      { nextMatchNumber: 90, matchNumbers: [73, 75] },
      { nextMatchNumber: 93, matchNumbers: [83, 84] },
      { nextMatchNumber: 94, matchNumbers: [81, 82] }
    ]
  },
  {
    key: "right",
    label: "Lado direito",
    subtitle: "16 seleções, caminho para a semifinal #102",
    pairs: [
      { nextMatchNumber: 91, matchNumbers: [76, 78] },
      { nextMatchNumber: 92, matchNumbers: [79, 80] },
      { nextMatchNumber: 95, matchNumbers: [86, 88] },
      { nextMatchNumber: 96, matchNumbers: [85, 87] }
    ]
  }
];

export function renderBracketSvg(
  state: BracketState,
  options: RenderBracketSvgOptions = {}
): string {
  return renderReferenceBracketSvg(state, options);
}

function renderLegacyBracketSvg(
  state: BracketState,
  options: RenderBracketSvgOptions = {}
): string {
  const title = options.title ?? "Copa do Mundo 2026 - Mata-mata";
  const roundOf32Matches =
    state.rounds.find((round) => round.key === "round_of_32")?.matches ?? [];
  const matchesByNumber = new Map(
    roundOf32Matches.map((match) => [matchNumberFor(match), match] as const)
  );
  const width = marginX * 2 + sideWidth * 2 + sideGap;
  const sideHeights = bracketSides.map((side) => sideHeight(side, matchesByNumber));
  const contentHeight = Math.max(1, ...sideHeights);
  const height = headerHeight + contentHeight + footerHeight;
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeAttribute(title)}">`,
    '<rect width="100%" height="100%" fill="#f5f1e6"/>',
    `<text x="${marginX}" y="46" font-family="Inter, Arial, sans-serif" font-size="32" font-weight="850" fill="#172033">${escapeText(title)}</text>`,
    `<text x="${marginX}" y="76" font-family="Inter, Arial, sans-serif" font-size="16" fill="#526071">${escapeText(phaseLabel(state))}</text>`,
    `<text x="${marginX}" y="104" font-family="Inter, Arial, sans-serif" font-size="13" fill="#7b8797">${escapeText("Rodada de 32 em duas metades, agrupada pelo caminho oficial dos vencedores.")}</text>`
  ];

  if (state.generatedAtLabel) {
    parts.push(
      `<text x="${width - marginX}" y="76" text-anchor="end" font-family="Inter, Arial, sans-serif" font-size="14" fill="#526071">${escapeText(state.generatedAtLabel)}</text>`
    );
  }

  parts.push(
    ...bracketSides.map((side, index) =>
      renderSide(side, matchesByNumber, marginX + index * (sideWidth + sideGap), headerHeight)
    )
  );

  if (state.notes.length > 0) {
    parts.push(
      `<text x="${marginX}" y="${height - 30}" font-family="Inter, Arial, sans-serif" font-size="12" fill="#687386">${escapeText(localizedNote(state.notes[0] ?? ""))}</text>`
    );
  }

  parts.push(
    `<text x="${width - marginX}" y="${height - 30}" text-anchor="end" font-family="Inter, Arial, sans-serif" font-size="12" fill="#687386">${escapeText(FOOTBALL_DATA_ATTRIBUTION)}</text>`,
    "</svg>"
  );

  return parts.join("");
}

function renderSide(
  side: BracketSide,
  matchesByNumber: ReadonlyMap<number, BracketMatch>,
  x: number,
  y: number
): string {
  const parts = [
    `<g data-bracket-side="${escapeAttribute(side.key)}" transform="translate(${x}, ${y})">`,
    `<text x="0" y="0" font-family="Inter, Arial, sans-serif" font-size="21" font-weight="850" fill="#172033">${escapeText(side.label)}</text>`,
    `<text x="0" y="24" font-family="Inter, Arial, sans-serif" font-size="12" fill="#738093">${escapeText(side.subtitle)}</text>`
  ];
  let currentY = 44;

  for (const pair of side.pairs) {
    const matches = pair.matchNumbers
      .map((matchNumber) => matchesByNumber.get(matchNumber))
      .filter((match): match is BracketMatch => match !== undefined);

    if (matches.length === 0) {
      continue;
    }

    parts.push(
      `<text x="0" y="${currentY - 8}" font-family="Inter, Arial, sans-serif" font-size="11" font-weight="750" fill="#8a5b14">${escapeText(`Vencedores se enfrentam no #${pair.nextMatchNumber}`)}</text>`
    );

    for (const match of matches) {
      parts.push(renderMatch(match, 0, currentY));
      currentY += matchHeight + matchGap;
    }

    currentY += pairGap;
  }

  parts.push("</g>");

  return parts.join("");
}

function renderMatch(match: BracketMatch, x: number, y: number): string {
  const status = matchStatusLabel(match);

  return [
    `<g data-match-id="${escapeAttribute(match.id)}" transform="translate(${x}, ${y})">`,
    `<rect width="${sideWidth}" height="${matchHeight}" rx="8" fill="#ffffff" stroke="#cfd7e1"/>`,
    `<rect width="5" height="${matchHeight}" rx="2.5" fill="${statusColor(match)}"/>`,
    `<text x="${matchPaddingX}" y="24" font-family="Inter, Arial, sans-serif" font-size="14" font-weight="850" fill="#172033">${escapeText(match.label)}</text>`,
    `<text x="${sideWidth - matchPaddingX}" y="24" text-anchor="end" font-family="Inter, Arial, sans-serif" font-size="11" font-weight="650" fill="#677386">${escapeText(status)}</text>`,
    matchHasTieWarning(match)
      ? `<text x="${sideWidth - matchPaddingX}" y="43" text-anchor="end" font-family="Inter, Arial, sans-serif" font-size="10" font-weight="750" fill="#9a5b00">ordem provisória</text>`
      : "",
    renderEntrant(match.home, matchPaddingX, 58),
    renderEntrant(match.away, matchPaddingX, 58 + entrantGap),
    "</g>"
  ].join("");
}

function renderEntrant(entrant: BracketEntrant, x: number, y: number): string {
  const hasFlag = entrant.teamCode !== undefined && flagInfoByTeamCode.has(entrant.teamCode);
  const primary =
    entrant.teamCode && entrant.teamName
      ? formatTeamName({ code: entrant.teamCode, name: entrant.teamName })
      : entrant.label;
  const secondary = entrant.sourceSlot ? `${entrant.sourceSlot} · ${entrant.label}` : entrant.label;
  const textX = hasFlag ? x + flagWidth + flagGap : x;

  return [
    hasFlag && entrant.teamCode ? renderFlagMarker(entrant.teamCode, x, y - 17) : "",
    `<text x="${textX}" y="${y}" font-family="Inter, Arial, sans-serif" font-size="17" font-weight="800" fill="#172033">${escapeText(primary)}</text>`,
    `<text x="${textX}" y="${y + 17}" font-family="Inter, Arial, sans-serif" font-size="11" fill="#728095">${escapeText(secondary)}</text>`
  ].join("");
}

function matchStatusLabel(match: BracketMatch): string {
  if (match.state === "provisional") {
    return "Como está";
  }

  if (match.state === "blocked") {
    return "Desempate manual";
  }

  if (match.state === "final") {
    return "Final";
  }

  return "Agendado";
}

function phaseLabel(state: BracketState): string {
  if (state.phase === "provisional") {
    return "Rodada de 32 - classificação provisória";
  }

  if (state.phase === "blocked") {
    return "Rodada de 32 - aguardando desempate manual";
  }

  return "Rodada de 32 definida pelos resultados finais dos grupos";
}

function statusColor(match: BracketMatch): string {
  if (match.state === "provisional") {
    return "#d99122";
  }

  if (match.state === "blocked") {
    return "#b54747";
  }

  if (match.state === "final") {
    return "#257b58";
  }

  return "#7b8797";
}

function localizedNote(note: string): string {
  if (note.startsWith("Round of 32 entrants are provisional")) {
    return "Entradas da Rodada de 32 são provisórias até todos os grupos e desempates serem resolvidos.";
  }

  if (note.startsWith("Round of 32 entrants are resolved")) {
    return "Entradas da Rodada de 32 definidas pelos resultados finais dos grupos.";
  }

  return note;
}

function sideHeight(
  side: BracketSide,
  matchesByNumber: ReadonlyMap<number, BracketMatch>
): number {
  const pairHeights = side.pairs.map((pair) => {
    const matchCount = pair.matchNumbers.filter((matchNumber) =>
      matchesByNumber.has(matchNumber)
    ).length;

    return matchCount === 0 ? 0 : 14 + matchCount * matchHeight + Math.max(0, matchCount - 1) * matchGap + pairGap;
  });

  return 44 + pairHeights.reduce((sum, height) => sum + height, 0);
}

function matchNumberFor(bracketMatch: BracketMatch): number {
  const labelMatch = /#(?<number>\d+)/.exec(bracketMatch.label);

  return Number(labelMatch?.groups?.number ?? 0);
}

function matchHasTieWarning(match: BracketMatch): boolean {
  return (
    match.home.warning === "tie-order-provisional" ||
    match.away.warning === "tie-order-provisional"
  );
}

function renderFlagMarker(teamCode: string, x: number, y: number): string {
  const flagInfo = flagInfoByTeamCode.get(teamCode);

  if (!flagInfo) {
    return "";
  }

  const stripeWidth = flagWidth / flagInfo.colors.length;
  const stripes = flagInfo.colors.map((color, index) =>
    `<rect x="${x + index * stripeWidth}" y="${y}" width="${stripeWidth + 0.5}" height="${flagHeight}" fill="${color}"/>`
  );

  return [
    `<g data-flag-code="${escapeAttribute(teamCode)}">`,
    `<clipPath id="flag-${escapeAttribute(teamCode)}-${x}-${y}"><rect x="${x}" y="${y}" width="${flagWidth}" height="${flagHeight}" rx="4"/></clipPath>`,
    `<g clip-path="url(#flag-${escapeAttribute(teamCode)}-${x}-${y})">`,
    ...stripes,
    "</g>",
    `<rect x="${x}" y="${y}" width="${flagWidth}" height="${flagHeight}" rx="4" fill="none" stroke="#cfd7e1"/>`,
    "</g>"
  ].join("");
}

function escapeText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttribute(value: string): string {
  return escapeText(value).replaceAll("\"", "&quot;");
}

interface BracketSide {
  key: "left" | "right";
  label: string;
  subtitle: string;
  pairs: readonly BracketPathPair[];
}

interface BracketPathPair {
  nextMatchNumber: number;
  matchNumbers: readonly number[];
}

const flagInfoByTeamCode = new Map<string, { colors: readonly string[] }>([
  ["ALG", { colors: ["#006233", "#ffffff", "#d21034"] }],
  ["ARG", { colors: ["#74acdf", "#ffffff", "#74acdf"] }],
  ["AUS", { colors: ["#012169", "#012169", "#c8102e"] }],
  ["AUT", { colors: ["#ed2939", "#ffffff", "#ed2939"] }],
  ["BEL", { colors: ["#000000", "#ffd90c", "#ef3340"] }],
  ["BIH", { colors: ["#002395", "#fecb00", "#002395"] }],
  ["BRA", { colors: ["#009b3a", "#ffdf00", "#002776"] }],
  ["CAN", { colors: ["#ff0000", "#ffffff", "#ff0000"] }],
  ["CIV", { colors: ["#f77f00", "#ffffff", "#009e60"] }],
  ["COD", { colors: ["#007fff", "#f7d618", "#ce1021"] }],
  ["COL", { colors: ["#fcd116", "#003893", "#ce1126"] }],
  ["CPV", { colors: ["#003893", "#ffffff", "#cf2027"] }],
  ["CRO", { colors: ["#ff0000", "#ffffff", "#171796"] }],
  ["CUW", { colors: ["#002b7f", "#f9e814", "#002b7f"] }],
  ["CZE", { colors: ["#ffffff", "#d7141a", "#11457e"] }],
  ["ECU", { colors: ["#ffdd00", "#034ea2", "#ed1c24"] }],
  ["EGY", { colors: ["#ce1126", "#ffffff", "#000000"] }],
  ["ENG", { colors: ["#ffffff", "#cf142b", "#ffffff"] }],
  ["ESP", { colors: ["#aa151b", "#f1bf00", "#aa151b"] }],
  ["FRA", { colors: ["#0055a4", "#ffffff", "#ef4135"] }],
  ["GER", { colors: ["#000000", "#dd0000", "#ffce00"] }],
  ["GHA", { colors: ["#ce1126", "#fcd116", "#006b3f"] }],
  ["HAI", { colors: ["#00209f", "#d21034", "#ffffff"] }],
  ["IRN", { colors: ["#239f40", "#ffffff", "#da0000"] }],
  ["IRQ", { colors: ["#ce1126", "#ffffff", "#000000"] }],
  ["JOR", { colors: ["#000000", "#ffffff", "#007a3d"] }],
  ["JPN", { colors: ["#ffffff", "#bc002d", "#ffffff"] }],
  ["KOR", { colors: ["#ffffff", "#c60c30", "#003478"] }],
  ["KSA", { colors: ["#006c35", "#ffffff", "#006c35"] }],
  ["MAR", { colors: ["#c1272d", "#006233", "#c1272d"] }],
  ["MEX", { colors: ["#006847", "#ffffff", "#ce1126"] }],
  ["NED", { colors: ["#ae1c28", "#ffffff", "#21468b"] }],
  ["NOR", { colors: ["#ba0c2f", "#ffffff", "#00205b"] }],
  ["NZL", { colors: ["#00247d", "#ffffff", "#cc142b"] }],
  ["PAN", { colors: ["#ffffff", "#d21034", "#005293"] }],
  ["PAR", { colors: ["#d52b1e", "#ffffff", "#0038a8"] }],
  ["POR", { colors: ["#006600", "#ff0000", "#ff0000"] }],
  ["QAT", { colors: ["#ffffff", "#8a1538", "#8a1538"] }],
  ["RSA", { colors: ["#007a4d", "#ffb612", "#002395"] }],
  ["SCO", { colors: ["#005eb8", "#ffffff", "#005eb8"] }],
  ["SEN", { colors: ["#00853f", "#fdef42", "#e31b23"] }],
  ["SUI", { colors: ["#ff0000", "#ffffff", "#ff0000"] }],
  ["SWE", { colors: ["#006aa7", "#fecc00", "#006aa7"] }],
  ["TUN", { colors: ["#e70013", "#ffffff", "#e70013"] }],
  ["TUR", { colors: ["#e30a17", "#ffffff", "#e30a17"] }],
  ["URU", { colors: ["#ffffff", "#3a75c4", "#ffffff"] }],
  ["USA", { colors: ["#b22234", "#ffffff", "#3c3b6e"] }],
  ["UZB", { colors: ["#1eb53a", "#ffffff", "#0099b5"] }]
]);
