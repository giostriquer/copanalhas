import type {
  ChaosDashboardModel,
  ChaosLeaderboardRow,
  ChaosMatchAward,
  ChaosMovementRow,
  ChaosPeopleAward
} from "./types.js";

const width = 1500;
const height = 900;
const margin = 44;
const headerHeight = 110;
const footerHeight = 44;
const columnGap = 24;
const leftWidth = 430;
const centerWidth = 500;
const rightWidth = width - margin * 2 - leftWidth - centerWidth - columnGap * 2;
const leftX = margin;
const centerX = leftX + leftWidth + columnGap;
const rightX = centerX + centerWidth + columnGap;
const contentTop = headerHeight + 18;
const font = "Inter, Arial, sans-serif";

export function renderChaosDashboardSvg(model: ChaosDashboardModel): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeAttribute(model.title)}">`,
    '<rect width="100%" height="100%" fill="#111827"/>',
    '<rect x="0" y="0" width="100%" height="122" fill="#f9c74f"/>',
    text(model.title, margin, 52, 34, "#111827", 900),
    text(`Resumo do periodo: ${model.period.label}`, margin, 82, 15, "#263040", 700),
    text(`Atualizado: ${model.generatedAtLabel}`, width - margin, 56, 14, "#263040", 700, "end"),
    text(
      `${model.totals.scoredMatches} jogos pontuados  |  ${model.totals.predictions} palpites  |  ${model.totals.finishedPredictions} palpites finalizados`,
      width - margin,
      84,
      13,
      "#263040",
      600,
      "end"
    ),
    renderPanel(leftX, contentTop, leftWidth, 636, "Placar Principal", [
      ...renderLeaderboard(model.leaderboardTop, leftX + 18, contentTop + 56),
      ...renderMovement(model.weeklyMovement, leftX + 18, contentTop + 308)
    ]),
    renderPanel(centerX, contentTop, centerWidth, 636, "Premios da Zoacao", renderPeopleAwards(model.peopleAwards)),
    renderPanel(rightX, contentTop, rightWidth, 636, "Caos dos Jogos", renderMatchAwards(model.matchAwards)),
    `<rect x="${margin}" y="${height - footerHeight - 12}" width="${width - margin * 2}" height="${footerHeight}" rx="7" fill="#1f2937"/>`,
    text(model.footer, margin + 18, height - 30, 13, "#e5e7eb", 700),
    "</svg>"
  ].join("");
}

function renderLeaderboard(rows: readonly ChaosLeaderboardRow[], x: number, y: number): string[] {
  if (rows.length === 0) {
    return [text("Ainda nao ha partidas pontuadas.", x, y, 16, "#f3f4f6", 800)];
  }

  const parts = [
    text("#  Pts  S  E  R  P   Jogador", x, y, 12, "#9ca3af", 800)
  ];

  rows.slice(0, 5).forEach((row, index) => {
    const rowY = y + 34 + index * 38;

    parts.push(
      `<rect x="${x - 8}" y="${rowY - 23}" width="${leftWidth - 20}" height="30" rx="6" fill="${index === 0 ? "#2a2f3d" : "#182230"}"/>`,
      text(String(row.rank), x, rowY, 14, "#f9c74f", 900),
      text(String(row.points), x + 42, rowY, 14, "#f3f4f6", 900),
      text(String(row.soloCount), x + 88, rowY, 12, "#d1d5db", 800),
      text(String(row.exactCount), x + 116, rowY, 12, "#d1d5db", 800),
      text(String(row.outcomeCount), x + 144, rowY, 12, "#d1d5db", 800),
      text(String(row.closestCount), x + 172, rowY, 12, "#d1d5db", 800),
      text(truncate(row.displayName, 25), x + 212, rowY, 14, "#f3f4f6", 850)
    );
  });

  return parts;
}

function renderMovement(
  movement: ChaosDashboardModel["weeklyMovement"],
  x: number,
  y: number
): string[] {
  const parts = [
    text("Sobe e Desce da Semana", x, y, 18, "#ffffff", 900)
  ];

  if (movement.status === "no-history") {
    return [...parts, text(movement.message, x, y + 34, 14, "#d1d5db", 700)];
  }

  const rows = [
    ...movement.climbers.map((row) => ({ ...row, marker: `+${row.movement}` })),
    ...movement.fallers.map((row) => ({ ...row, marker: String(row.movement) })),
    ...movement.newcomers.map((row) => ({ ...row, marker: "novo" }))
  ].slice(0, 6);

  if (rows.length === 0) {
    return [...parts, text("Ninguem se mexeu. A vergonha ficou estavel.", x, y + 34, 14, "#d1d5db", 700)];
  }

  rows.forEach((row, index) => {
    const rowY = y + 36 + index * 31;
    const color = row.movement > 0 ? "#22c55e" : row.movement < 0 ? "#ef4444" : "#f9c74f";

    parts.push(
      text(row.marker, x, rowY, 14, color, 900),
      text(truncate(row.displayName, 30), x + 58, rowY, 13, "#f3f4f6", 800),
      text(`#${row.rank}`, x + 330, rowY, 12, "#9ca3af", 800)
    );
  });

  return parts;
}

function renderPeopleAwards(awards: readonly ChaosPeopleAward[]): string[] {
  return awards.slice(0, 8).flatMap((award, index) => {
    const x = centerX + 18 + (index % 2) * 232;
    const y = contentTop + 54 + Math.floor(index / 2) * 136;

    return renderAwardCard({
      x,
      y,
      width: 214,
      height: 112,
      title: award.title,
      subject: award.subject,
      value: award.value,
      subtitle: award.subtitle,
      accent: index % 3 === 0 ? "#ef4444" : index % 3 === 1 ? "#06b6d4" : "#f9c74f"
    });
  });
}

function renderMatchAwards(awards: readonly ChaosMatchAward[]): string[] {
  return awards.slice(0, 5).flatMap((award, index) => {
    const y = contentTop + 54 + index * 112;

    return renderAwardCard({
      x: rightX + 18,
      y,
      width: rightWidth - 36,
      height: 92,
      title: award.title,
      subject: award.matchLabel,
      value: award.value,
      subtitle: award.subtitle,
      accent: index % 2 === 0 ? "#f97316" : "#a3e635"
    });
  });
}

function renderPanel(
  x: number,
  y: number,
  panelWidth: number,
  panelHeight: number,
  title: string,
  children: string[]
): string {
  return [
    `<g transform="translate(${x}, ${y})">`,
    `<rect width="${panelWidth}" height="${panelHeight}" rx="8" fill="#172033" stroke="#334155"/>`,
    text(title, 18, 32, 20, "#ffffff", 900),
    "</g>",
    ...children
  ].join("");
}

function renderAwardCard(input: {
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  subject: string;
  value: string;
  subtitle: string;
  accent: string;
}): string[] {
  return [
    `<rect x="${input.x}" y="${input.y}" width="${input.width}" height="${input.height}" rx="7" fill="#f8fafc"/>`,
    `<rect x="${input.x}" y="${input.y}" width="5" height="${input.height}" rx="2" fill="${input.accent}"/>`,
    text(input.title, input.x + 16, input.y + 24, 13, "#111827", 900),
    text(truncate(input.subject, input.width > 260 ? 38 : 24), input.x + 16, input.y + 50, 15, "#111827", 900),
    text(input.value, input.x + 16, input.y + 73, 13, "#334155", 900),
    text(truncate(input.subtitle, input.width > 260 ? 54 : 28), input.x + 16, input.y + input.height - 14, 10, "#64748b", 700)
  ];
}

function text(
  value: string,
  x: number,
  y: number,
  size: number,
  color: string,
  weight: number,
  anchor: "start" | "end" | "middle" = "start"
): string {
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${font}" font-size="${size}" font-weight="${weight}" fill="${color}">${escapeText(value)}</text>`;
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1))}.`;
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
