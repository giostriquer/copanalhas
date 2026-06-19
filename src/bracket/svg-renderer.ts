import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

import type { BracketEntrant, BracketMatch, BracketState } from "./types.js";
import { formatCompactTeamName } from "../worldcup/team-display.js";

export interface RenderReferenceBracketSvgOptions {
  title?: string;
}

const require = createRequire(import.meta.url);
const FOOTBALL_DATA_ATTRIBUTION = "Football data provided by the Football-Data.org API.";
const marginX = 44;
const headerHeight = 112;
const footerHeight = 52;
const sideWidth = 634;
const sideGap = 46;
const sideHeaderHeight = 50;
const r32X = 0;
const r16X = 306;
const qfX = 512;
const r32Width = 252;
const r16Width = 160;
const qfWidth = 116;
const r32Height = 66;
const nextHeight = 58;
const r32Gap = 26;
const flagWidth = 23;
const flagHeight = 16;
const teamTextMaxLength = 18;
const connectorColor = "#4f8f38";

const bracketSides: readonly BracketSide[] = [
  {
    key: "left",
    label: "Lado esquerdo",
    subtitle: "caminho para a semifinal #101",
    pairs: [
      { nextMatchNumber: 89, matchNumbers: [74, 77] },
      { nextMatchNumber: 90, matchNumbers: [73, 75] },
      { nextMatchNumber: 93, matchNumbers: [83, 84] },
      { nextMatchNumber: 94, matchNumbers: [81, 82] }
    ],
    quarterFinals: [
      { nextMatchNumber: 97, sourceMatchNumbers: [89, 90] },
      { nextMatchNumber: 98, sourceMatchNumbers: [93, 94] }
    ]
  },
  {
    key: "right",
    label: "Lado direito",
    subtitle: "caminho para a semifinal #102",
    pairs: [
      { nextMatchNumber: 91, matchNumbers: [76, 78] },
      { nextMatchNumber: 92, matchNumbers: [79, 80] },
      { nextMatchNumber: 95, matchNumbers: [86, 88] },
      { nextMatchNumber: 96, matchNumbers: [85, 87] }
    ],
    quarterFinals: [
      { nextMatchNumber: 99, sourceMatchNumbers: [91, 92] },
      { nextMatchNumber: 100, sourceMatchNumbers: [95, 96] }
    ]
  }
];

export function renderReferenceBracketSvg(
  state: BracketState,
  options: RenderReferenceBracketSvgOptions = {}
): string {
  const title = options.title ?? "Copa do Mundo 2026 - Mata-mata";
  const roundOf32Matches =
    state.rounds.find((round) => round.key === "round_of_32")?.matches ?? [];
  const matchesByNumber = new Map(
    roundOf32Matches.map((match) => [matchNumberFor(match), match] as const)
  );
  const width = marginX * 2 + sideWidth * 2 + sideGap;
  const contentHeight = sideHeight();
  const height = headerHeight + contentHeight + footerHeight;
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeAttribute(title)}">`,
    '<rect width="100%" height="100%" fill="#f7f7f5"/>',
    `<text x="${marginX}" y="42" font-family="Inter, Arial, sans-serif" font-size="30" font-weight="850" fill="#141b2b">${escapeText(title)}</text>`,
    `<text x="${marginX}" y="72" font-family="Inter, Arial, sans-serif" font-size="15" fill="#4e596a">${escapeText(phaseLabel(state))}</text>`,
    `<text x="${marginX}" y="96" font-family="Inter, Arial, sans-serif" font-size="12" fill="#798394">${escapeText("Rodada de 32 com caminhos oficiais para oitavas e quartas.")}</text>`
  ];

  if (state.generatedAtLabel) {
    parts.push(
      `<text x="${width - marginX}" y="72" text-anchor="end" font-family="Inter, Arial, sans-serif" font-size="13" fill="#4e596a">${escapeText(state.generatedAtLabel)}</text>`
    );
  }

  parts.push(
    ...bracketSides.map((side, index) =>
      renderSide(side, matchesByNumber, marginX + index * (sideWidth + sideGap), headerHeight)
    )
  );

  if (state.notes.length > 0) {
    parts.push(
      `<text x="${marginX}" y="${height - 24}" font-family="Inter, Arial, sans-serif" font-size="11" fill="#687386">${escapeText(localizedNote(state.notes[0] ?? ""))}</text>`
    );
  }

  parts.push(
    `<text x="${width - marginX}" y="${height - 24}" text-anchor="end" font-family="Inter, Arial, sans-serif" font-size="11" fill="#687386">${escapeText(FOOTBALL_DATA_ATTRIBUTION)}</text>`,
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
  const layout = layoutSide(side, matchesByNumber);
  const parts = [
    `<g data-bracket-side="${escapeAttribute(side.key)}" transform="translate(${x}, ${y})">`,
    `<text x="0" y="0" font-family="Inter, Arial, sans-serif" font-size="20" font-weight="850" fill="#141b2b">${escapeText(side.label)}</text>`,
    `<text x="0" y="22" font-family="Inter, Arial, sans-serif" font-size="11" fill="#6f7b8d">${escapeText(side.subtitle)}</text>`,
    `<g data-bracket-column="round-of-32"><text x="${r32X + r32Width / 2}" y="44" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="13" font-weight="800" fill="#141b2b">Rodada de 32</text></g>`,
    `<g data-bracket-column="round-of-16"><text x="${r16X + r16Width / 2}" y="44" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="13" font-weight="800" fill="#141b2b">Oitavas</text></g>`,
    `<g data-bracket-column="quarter-finals"><text x="${qfX + qfWidth / 2}" y="44" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="13" font-weight="800" fill="#141b2b">Quartas</text></g>`
  ];

  for (const r16Box of layout.roundOf16Boxes) {
    parts.push(renderRoundOf16Connector(r16Box), renderPathBox(r16Box));
  }

  for (const quarterFinalBox of layout.quarterFinalBoxes) {
    parts.push(renderQuarterFinalConnector(quarterFinalBox), renderPathBox(quarterFinalBox));
  }

  for (const matchBox of layout.roundOf32Boxes) {
    parts.push(renderRoundOf32Match(matchBox.match, r32X, matchBox.y));
  }

  parts.push("</g>");

  return parts.join("");
}

function layoutSide(
  side: BracketSide,
  matchesByNumber: ReadonlyMap<number, BracketMatch>
): BracketSideLayout {
  const roundOf32Boxes: RoundOf32Box[] = [];
  const roundOf16Boxes: PathBox[] = [];
  const quarterFinalBoxes: PathBox[] = [];
  let matchIndex = 0;

  for (const pair of side.pairs) {
    const sourceBoxes: RoundOf32Box[] = [];

    for (const matchNumber of pair.matchNumbers) {
      const match = matchesByNumber.get(matchNumber);

      if (!match) {
        continue;
      }

      const matchBox = {
        match,
        matchNumber,
        y: sideHeaderHeight + matchIndex * (r32Height + r32Gap),
        height: r32Height
      };
      roundOf32Boxes.push(matchBox);
      sourceBoxes.push(matchBox);
      matchIndex += 1;
    }

    if (sourceBoxes.length === 0) {
      continue;
    }

    const firstSourceBox = sourceBoxes[0];
    const lastSourceBox = sourceBoxes.at(-1);

    if (!firstSourceBox || !lastSourceBox) {
      continue;
    }

    const centerY = (centerYForBox(firstSourceBox) + centerYForBox(lastSourceBox)) / 2;
    roundOf16Boxes.push({
      kind: "round-of-16",
      matchNumber: pair.nextMatchNumber,
      sourceLabels: sourceBoxes.map((box) => `Vencedor #${box.matchNumber}`),
      sourceCenters: sourceBoxes.map(centerYForBox),
      x: r16X,
      y: centerY - nextHeight / 2,
      width: r16Width,
      height: nextHeight
    });
  }

  for (const quarterFinal of side.quarterFinals) {
    const sourceBoxes = quarterFinal.sourceMatchNumbers
      .map((matchNumber) =>
        roundOf16Boxes.find((roundOf16Box) => roundOf16Box.matchNumber === matchNumber)
      )
      .filter((box): box is PathBox => box !== undefined);

    if (sourceBoxes.length === 0) {
      continue;
    }

    const firstSourceBox = sourceBoxes[0];
    const lastSourceBox = sourceBoxes.at(-1);

    if (!firstSourceBox || !lastSourceBox) {
      continue;
    }

    const centerY = (centerYForBox(firstSourceBox) + centerYForBox(lastSourceBox)) / 2;
    quarterFinalBoxes.push({
      kind: "quarter-finals",
      matchNumber: quarterFinal.nextMatchNumber,
      sourceLabels: sourceBoxes.map((box) => `Vencedor #${box.matchNumber}`),
      sourceCenters: sourceBoxes.map(centerYForBox),
      x: qfX,
      y: centerY - nextHeight / 2,
      width: qfWidth,
      height: nextHeight
    });
  }

  return { roundOf32Boxes, roundOf16Boxes, quarterFinalBoxes };
}

function renderRoundOf32Match(match: BracketMatch, x: number, y: number): string {
  const matchNumber = matchNumberFor(match);

  return [
    `<g data-match-id="${escapeAttribute(match.id)}" data-bracket-match-number="${matchNumber}" transform="translate(${x}, ${y})">`,
    `<text x="0" y="-8" font-family="Inter, Arial, sans-serif" font-size="9" fill="#273140">${escapeText(matchStatusLabel(match))}</text>`,
    `<rect width="${r32Width}" height="${r32Height}" fill="#ffffff"/>`,
    `<rect width="3" height="${r32Height}" fill="${statusColor(match)}"/>`,
    `<line x1="${r32Width - 52}" y1="0" x2="${r32Width - 52}" y2="${r32Height}" stroke="#edf0f3"/>`,
    `<line x1="3" y1="${r32Height / 2}" x2="${r32Width}" y2="${r32Height / 2}" stroke="#edf0f3"/>`,
    `<text x="${r32Width - 26}" y="25" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="12" font-weight="850" fill="#141b2b">#${matchNumber}</text>`,
    `<text x="${r32Width - 26}" y="43" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="8" fill="#778397">${escapeText(matchLabelSuffix(match))}</text>`,
    matchHasTieWarning(match)
      ? `<text x="${r32Width - 7}" y="-8" text-anchor="end" font-family="Inter, Arial, sans-serif" font-size="8" font-weight="750" fill="#9a5b00">ordem provisória</text>`
      : "",
    renderEntrantRow(match.home, 12, 21),
    renderEntrantRow(match.away, 12, 53),
    "</g>"
  ].join("");
}

function renderPathBox(pathBox: PathBox): string {
  const [firstLabel = "", secondLabel = ""] = pathBox.sourceLabels;

  return [
    `<g data-path-match="${pathBox.matchNumber}" transform="translate(${pathBox.x}, ${pathBox.y})">`,
    `<text x="0" y="-8" font-family="Inter, Arial, sans-serif" font-size="9" fill="#273140">Agendado</text>`,
    `<rect width="${pathBox.width}" height="${pathBox.height}" fill="#ffffff"/>`,
    `<rect width="3" height="${pathBox.height}" fill="#1d2635"/>`,
    `<line x1="3" y1="${pathBox.height / 2}" x2="${pathBox.width}" y2="${pathBox.height / 2}" stroke="#edf0f3"/>`,
    `<text x="16" y="22" font-family="Inter, Arial, sans-serif" font-size="11" font-weight="850" fill="#141b2b">#${pathBox.matchNumber}</text>`,
    `<text x="16" y="42" font-family="Inter, Arial, sans-serif" font-size="10" fill="#42506a">${escapeText(firstLabel)}</text>`,
    `<text x="16" y="54" font-family="Inter, Arial, sans-serif" font-size="10" fill="#42506a">${escapeText(secondLabel)}</text>`,
    "</g>"
  ].join("");
}

function renderRoundOf16Connector(pathBox: PathBox): string {
  const sourceX = r32X + r32Width;
  const targetX = pathBox.x;
  const jointX = targetX - 26;
  const centerY = centerYForBox(pathBox);
  const [firstY = centerY, secondY = centerY] = pathBox.sourceCenters;

  return `<path data-connector-match="${pathBox.matchNumber}" d="M ${sourceX} ${firstY} H ${jointX} V ${secondY} H ${sourceX} M ${jointX} ${centerY} H ${targetX}" fill="none" stroke="${connectorColor}" stroke-width="1.4"/>`;
}

function renderQuarterFinalConnector(pathBox: PathBox): string {
  const sourceX = r16X + r16Width;
  const targetX = pathBox.x;
  const jointX = targetX - 26;
  const centerY = centerYForBox(pathBox);
  const [firstY = centerY, secondY = centerY] = pathBox.sourceCenters;

  return `<path data-connector-match="${pathBox.matchNumber}" d="M ${sourceX} ${firstY} H ${jointX} V ${secondY} H ${sourceX} M ${jointX} ${centerY} H ${targetX}" fill="none" stroke="${connectorColor}" stroke-width="1.4"/>`;
}

function renderEntrantRow(entrant: BracketEntrant, x: number, baselineY: number): string {
  const primary =
    entrant.teamCode && entrant.teamName
      ? formatCompactTeamName({ code: entrant.teamCode, name: entrant.teamName }, teamTextMaxLength)
      : entrant.label;
  const flag = entrant.teamCode
    ? renderFlagImage(entrant.teamCode, x, baselineY - flagHeight + 2)
    : "";
  const textX = flag ? x + flagWidth + 7 : x;

  return [
    flag,
    `<text x="${textX}" y="${baselineY}" font-family="Inter, Arial, sans-serif" font-size="13" font-weight="800" fill="#141b2b">${escapeText(primary)}</text>`
  ].join("");
}

function renderFlagImage(teamCode: string, x: number, y: number): string {
  const asset = flagAssetForTeamCode(teamCode);

  if (!asset) {
    return "";
  }

  const clipId = `flag-${escapeAttribute(teamCode)}-${x}-${y}`;

  return [
    `<g data-flag-team-code="${escapeAttribute(teamCode)}" data-flag-asset="${escapeAttribute(asset.fileName)}">`,
    `<clipPath id="${clipId}"><rect x="${x}" y="${y}" width="${flagWidth}" height="${flagHeight}" rx="1.5"/></clipPath>`,
    `<image x="${x}" y="${y}" width="${flagWidth}" height="${flagHeight}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})" href="${asset.href}" xlink:href="${asset.href}"/>`,
    `<rect x="${x}" y="${y}" width="${flagWidth}" height="${flagHeight}" rx="1.5" fill="none" stroke="#d1d7df" stroke-width="0.6"/>`,
    "</g>"
  ].join("");
}

function flagAssetForTeamCode(teamCode: string): FlagAsset | undefined {
  const flagCode = flagIconCodeByTeamCode.get(teamCode);

  if (!flagCode) {
    return undefined;
  }

  const cached = flagAssetCache.get(flagCode);

  if (cached) {
    return cached;
  }

  const fileName = `${flagCode}.svg`;
  const sourcePath = join(flagIconsRoot(), "flags", "4x3", fileName);
  const data = readFileSync(sourcePath).toString("base64");
  const asset = {
    fileName,
    href: `data:image/svg+xml;base64,${data}`
  };
  flagAssetCache.set(flagCode, asset);

  return asset;
}

function flagIconsRoot(): string {
  const packageJsonPath = require.resolve("flag-icons/package.json");

  return dirname(packageJsonPath);
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

function matchLabelSuffix(match: BracketMatch): string {
  const homeSlot = match.home.sourceSlot ?? match.home.label;
  const awaySlot = match.away.sourceSlot ?? match.away.label;

  return `${homeSlot}/${awaySlot}`;
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
    return "#1d2635";
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

function sideHeight(): number {
  return sideHeaderHeight + 8 * r32Height + 7 * r32Gap;
}

function centerYForBox(box: BoxPosition): number {
  return box.y + box.height / 2;
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
  quarterFinals: readonly BracketPathPairResult[];
}

interface BracketPathPair {
  nextMatchNumber: number;
  matchNumbers: readonly number[];
}

interface BracketPathPairResult {
  nextMatchNumber: number;
  sourceMatchNumbers: readonly number[];
}

interface BracketSideLayout {
  roundOf32Boxes: RoundOf32Box[];
  roundOf16Boxes: PathBox[];
  quarterFinalBoxes: PathBox[];
}

interface BoxPosition {
  y: number;
  height: number;
}

interface RoundOf32Box extends BoxPosition {
  match: BracketMatch;
  matchNumber: number;
}

interface PathBox extends BoxPosition {
  kind: "round-of-16" | "quarter-finals";
  matchNumber: number;
  sourceLabels: string[];
  sourceCenters: number[];
  x: number;
  width: number;
}

interface FlagAsset {
  fileName: string;
  href: string;
}

const flagAssetCache = new Map<string, FlagAsset>();

const flagIconCodeByTeamCode = new Map<string, string>([
  ["ALG", "dz"],
  ["ARG", "ar"],
  ["AUS", "au"],
  ["AUT", "at"],
  ["BEL", "be"],
  ["BIH", "ba"],
  ["BRA", "br"],
  ["CAN", "ca"],
  ["CIV", "ci"],
  ["COD", "cd"],
  ["COL", "co"],
  ["CPV", "cv"],
  ["CRO", "hr"],
  ["CUW", "cw"],
  ["CZE", "cz"],
  ["ECU", "ec"],
  ["EGY", "eg"],
  ["ENG", "gb-eng"],
  ["ESP", "es"],
  ["FRA", "fr"],
  ["GER", "de"],
  ["GHA", "gh"],
  ["HAI", "ht"],
  ["IRN", "ir"],
  ["IRQ", "iq"],
  ["JOR", "jo"],
  ["JPN", "jp"],
  ["KOR", "kr"],
  ["KSA", "sa"],
  ["MAR", "ma"],
  ["MEX", "mx"],
  ["NED", "nl"],
  ["NOR", "no"],
  ["NZL", "nz"],
  ["PAN", "pa"],
  ["PAR", "py"],
  ["POR", "pt"],
  ["QAT", "qa"],
  ["RSA", "za"],
  ["SCO", "gb-sct"],
  ["SEN", "sn"],
  ["SUI", "ch"],
  ["SWE", "se"],
  ["TUN", "tn"],
  ["TUR", "tr"],
  ["URU", "uy"],
  ["USA", "us"],
  ["UZB", "uz"]
]);
