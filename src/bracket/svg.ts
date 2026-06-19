import type { BracketEntrant, BracketMatch, BracketState } from "./types.js";

export interface RenderBracketSvgOptions {
  title?: string;
}

const FOOTBALL_DATA_ATTRIBUTION = "Football data provided by the Football-Data.org API.";
const marginX = 40;
const headerHeight = 92;
const footerHeight = 48;
const columnWidth = 304;
const columnGap = 34;
const matchHeight = 84;
const matchGap = 18;
const entrantGap = 34;

export function renderBracketSvg(
  state: BracketState,
  options: RenderBracketSvgOptions = {}
): string {
  const title = options.title ?? "World Cup 2026 Bracket";
  const maxMatches = Math.max(1, ...state.rounds.map((round) => round.matches.length));
  const width =
    marginX * 2 +
    state.rounds.length * columnWidth +
    Math.max(0, state.rounds.length - 1) * columnGap;
  const contentHeight = maxMatches * matchHeight + Math.max(0, maxMatches - 1) * matchGap;
  const height = headerHeight + contentHeight + footerHeight;
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeAttribute(title)}">`,
    `<rect width="100%" height="100%" fill="#f7f3e8"/>`,
    `<text x="${marginX}" y="42" font-family="Inter, Arial, sans-serif" font-size="30" font-weight="800" fill="#18212f">${escapeText(title)}</text>`,
    `<text x="${marginX}" y="70" font-family="Inter, Arial, sans-serif" font-size="15" fill="#4c5666">${escapeText(phaseLabel(state))}</text>`
  ];

  if (state.generatedAtLabel) {
    parts.push(
      `<text x="${width - marginX}" y="70" text-anchor="end" font-family="Inter, Arial, sans-serif" font-size="14" fill="#4c5666">${escapeText(state.generatedAtLabel)}</text>`
    );
  }

  state.rounds.forEach((round, roundIndex) => {
    const x = marginX + roundIndex * (columnWidth + columnGap);

    parts.push(
      `<text x="${x}" y="${headerHeight - 12}" font-family="Inter, Arial, sans-serif" font-size="17" font-weight="800" fill="#18212f">${escapeText(round.label)}</text>`
    );

    round.matches.forEach((match, matchIndex) => {
      const y = headerHeight + matchIndex * (matchHeight + matchGap);

      parts.push(renderMatch(match, x, y));
    });
  });

  if (state.notes.length > 0) {
    parts.push(
      `<text x="${marginX}" y="${height - 28}" font-family="Inter, Arial, sans-serif" font-size="12" fill="#687386">${escapeText(state.notes[0] ?? "")}</text>`
    );
  }

  parts.push(
    `<text x="${width - marginX}" y="${height - 28}" text-anchor="end" font-family="Inter, Arial, sans-serif" font-size="12" fill="#687386">${escapeText(FOOTBALL_DATA_ATTRIBUTION)}</text>`,
    "</svg>"
  );

  return parts.join("");
}

function renderMatch(match: BracketMatch, x: number, y: number): string {
  const status = matchStatusLabel(match);

  return [
    `<g data-match-id="${escapeAttribute(match.id)}" transform="translate(${x}, ${y})">`,
    `<rect width="${columnWidth}" height="${matchHeight}" rx="7" fill="#ffffff" stroke="#cfd6df"/>`,
    `<text x="14" y="22" font-family="Inter, Arial, sans-serif" font-size="13" font-weight="800" fill="#1b2635">${escapeText(match.label)}</text>`,
    `<text x="${columnWidth - 14}" y="22" text-anchor="end" font-family="Inter, Arial, sans-serif" font-size="11" fill="#697487">${escapeText(status)}</text>`,
    renderEntrant(match.home, 14, 45),
    renderEntrant(match.away, 14, 45 + entrantGap),
    "</g>"
  ].join("");
}

function renderEntrant(entrant: BracketEntrant, x: number, y: number): string {
  const primary = entrant.teamName ?? entrant.label;
  const secondary = entrant.sourceSlot ? `${entrant.sourceSlot} - ${entrant.label}` : entrant.label;
  const warning =
    entrant.warning === "tie-order-provisional"
      ? `<text x="${columnWidth - 14}" y="${y}" text-anchor="end" font-family="Inter, Arial, sans-serif" font-size="10" fill="#9a5b00">tie-order provisional</text>`
      : "";

  return [
    `<text x="${x}" y="${y}" font-family="Inter, Arial, sans-serif" font-size="13" font-weight="700" fill="#18212f">${escapeText(primary)}</text>`,
    `<text x="${x}" y="${y + 15}" font-family="Inter, Arial, sans-serif" font-size="10" fill="#6f7a89">${escapeText(secondary)}</text>`,
    warning
  ].join("");
}

function matchStatusLabel(match: BracketMatch): string {
  if (match.state === "provisional") {
    return "As it stands";
  }

  if (match.state === "blocked") {
    return "Needs tiebreaker";
  }

  if (match.state === "final") {
    return "Final";
  }

  return "Scheduled";
}

function phaseLabel(state: BracketState): string {
  if (state.phase === "provisional") {
    return "As it stands during the group stage";
  }

  if (state.phase === "blocked") {
    return "Waiting on manual tiebreaker review";
  }

  return "Round of 32 resolved from final group results";
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
