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
const columnGap = 24;
const leftWidth = 430;
const centerWidth = 500;
const rightWidth = width - margin * 2 - leftWidth - centerWidth - columnGap * 2;
const leftX = margin;
const centerX = leftX + leftWidth + columnGap;
const rightX = centerX + centerWidth + columnGap;
const contentTop = headerHeight + 18;
const panelHeight = height - contentTop - margin;
const font = "Inter, Arial, sans-serif";
const brazilYellow = "#FFDF00";
const brazilBlue = "#002776";
const brazilPanelBlue = "#001f5c";
const brazilPanelStroke = "#1e64d1";
const brazilGreen = "#009C3B";

export function renderChaosDashboardSvg(model: ChaosDashboardModel): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeAttribute(model.title)}">`,
    `<rect width="100%" height="100%" fill="${brazilBlue}"/>`,
    `<rect x="0" y="0" width="100%" height="122" fill="${brazilYellow}"/>`,
    text(model.title, margin, 52, 34, brazilBlue, 900),
    text(`Resumo do periodo: ${model.period.label}`, margin, 82, 15, brazilBlue, 700),
    text(`Atualizado: ${model.generatedAtLabel}`, width - margin, 56, 14, brazilBlue, 700, "end"),
    text(
      `${model.totals.scoredMatches} jogos pontuados  |  ${model.totals.predictions} palpites  |  ${model.totals.finishedPredictions} palpites finalizados`,
      width - margin,
      84,
      13,
      brazilBlue,
      600,
      "end"
    ),
    renderPanel(leftX, contentTop, leftWidth, panelHeight, "Placar Principal", [
      ...renderLeaderboard(model.leaderboardTop, leftX + 18, contentTop + 56),
      ...renderLeaderCard(model.leaderOfWeek, leftX + 18, contentTop + 276),
      ...renderMovement(model.weeklyMovement, leftX + 18, contentTop + 436)
    ]),
    renderPanel(centerX, contentTop, centerWidth, panelHeight, "Genios e Copazus", renderPeopleAwards(model.peopleAwards)),
    renderPanel(rightX, contentTop, rightWidth, panelHeight, "Highlights", renderMatchAwards(model.matchAwards)),
    "</svg>"
  ].join("");
}

function renderLeaderCard(
  leader: ChaosDashboardModel["leaderOfWeek"],
  x: number,
  y: number
): string[] {
  if (!leader) {
    return [];
  }

  const avatarSize = 76;
  const avatarX = x + 18;
  const avatarY = y + 22;
  const avatarCenterX = avatarX + avatarSize / 2;
  const avatarCenterY = avatarY + avatarSize / 2;
  const clipId = "chaos-leader-avatar";
  const avatar = leader.avatarDataUri
    ? [
        `<defs><clipPath id="${clipId}"><circle cx="${avatarCenterX}" cy="${avatarCenterY}" r="${avatarSize / 2}"/></clipPath></defs>`,
        `<image href="${escapeAttribute(leader.avatarDataUri)}" x="${avatarX}" y="${avatarY}" width="${avatarSize}" height="${avatarSize}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"/>`
      ]
    : [
        `<circle cx="${avatarCenterX}" cy="${avatarCenterY}" r="${avatarSize / 2}" fill="${brazilYellow}"/>`,
        text(initialsForName(leader.displayName), avatarCenterX, avatarCenterY + 9, 26, brazilBlue, 900, "middle")
      ];

  return [
    `<rect x="${x - 8}" y="${y}" width="${leftWidth - 20}" height="120" rx="8" fill="#f8fafc"/>`,
    `<rect x="${x - 8}" y="${y}" width="6" height="120" rx="3" fill="${brazilGreen}"/>`,
    ...avatar,
    `<circle cx="${avatarCenterX}" cy="${avatarCenterY}" r="${avatarSize / 2}" fill="none" stroke="${brazilYellow}" stroke-width="4"/>`,
    text("Lider da Semana", x + 112, y + 30, 13, brazilBlue, 900),
    text(truncate(leader.displayName, 22), x + 112, y + 58, 19, "#111827", 900),
    text(`${leader.points} pts`, x + 112, y + 84, 16, brazilBlue, 900),
    text(`Solo ${leader.soloCount}   Exato ${leader.exactCount}`, x + 112, y + 102, 10, "#475569", 800),
    text(`Resultado ${leader.outcomeCount}   Perto ${leader.closestCount}`, x + 112, y + 116, 10, "#475569", 800)
  ];
}

function renderLeaderboard(rows: readonly ChaosLeaderboardRow[], x: number, y: number): string[] {
  if (rows.length === 0) {
    return [text("Ainda nao ha partidas pontuadas.", x, y, 16, "#f3f4f6", 800)];
  }

  const parts = [
    text("#", x, y, 10, "#9ca3af", 800, "middle"),
    text("Jogador", x + 26, y, 10, "#9ca3af", 800),
    text("Pts", x + 198, y, 10, "#9ca3af", 800, "middle"),
    text("Solo", x + 238, y, 9, "#9ca3af", 800, "middle"),
    text("Exato", x + 278, y, 9, "#9ca3af", 800, "middle"),
    text("Resultado", x + 326, y, 8, "#9ca3af", 800, "middle"),
    text("Perto", x + 382, y, 9, "#9ca3af", 800, "middle")
  ];

  rows.slice(0, 5).forEach((row, index) => {
    const rowY = y + 34 + index * 38;

    parts.push(
      `<rect x="${x - 8}" y="${rowY - 23}" width="${leftWidth - 20}" height="30" rx="6" fill="${index === 0 ? "#0047ab" : "#00358f"}"/>`,
      text(String(row.rank), x, rowY, 14, brazilYellow, 900, "middle"),
      text(truncate(row.displayName, 22), x + 26, rowY, 13, "#f3f4f6", 850),
      text(String(row.points), x + 198, rowY, 14, "#f3f4f6", 900, "middle"),
      text(String(row.soloCount), x + 238, rowY, 12, "#d1d5db", 800, "middle"),
      text(String(row.exactCount), x + 278, rowY, 12, "#d1d5db", 800, "middle"),
      text(String(row.outcomeCount), x + 326, rowY, 12, "#d1d5db", 800, "middle"),
      text(String(row.closestCount), x + 382, rowY, 12, "#d1d5db", 800, "middle")
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
    const color = row.movement > 0 ? "#22c55e" : row.movement < 0 ? "#ef4444" : brazilYellow;

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
      height: 126,
      title: award.title,
      subject: award.subject,
      value: award.value,
      subtitle: award.subtitle,
      accent: index % 3 === 0 ? brazilGreen : index % 3 === 1 ? brazilBlue : brazilYellow
    });
  });
}

function renderMatchAwards(awards: readonly ChaosMatchAward[]): string[] {
  return awards.slice(0, 5).flatMap((award, index) => {
    const y = contentTop + 54 + index * 120;

    return renderAwardCard({
      x: rightX + 18,
      y,
      width: rightWidth - 36,
      height: 108,
      title: award.title,
      subject: award.matchLabel,
      value: award.value,
      subtitle: award.subtitle,
      accent: index % 2 === 0 ? brazilGreen : brazilYellow
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
    `<rect width="${panelWidth}" height="${panelHeight}" rx="8" fill="${brazilPanelBlue}" stroke="${brazilPanelStroke}"/>`,
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
  const wide = input.width > 260;
  const subtitleLines = wrapText(input.subtitle, wide ? 58 : 26, 2);
  const subtitleStartY = input.y + (wide ? 91 : 94);

  return [
    `<rect x="${input.x}" y="${input.y}" width="${input.width}" height="${input.height}" rx="7" fill="#f8fafc"/>`,
    `<rect x="${input.x}" y="${input.y}" width="5" height="${input.height}" rx="2" fill="${input.accent}"/>`,
    text(input.title, input.x + 16, input.y + 24, 13, "#111827", 900),
    text(truncate(input.subject, wide ? 38 : 24), input.x + 16, input.y + 50, 15, "#111827", 900),
    text(input.value, input.x + 16, input.y + 72, 13, "#334155", 900),
    ...subtitleLines.map((line, index) =>
      text(line, input.x + 16, subtitleStartY + index * 13, 10, "#64748b", 700)
    )
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

function wrapText(value: string, maxLineLength: number, maxLines: number): string[] {
  const words = value.split(/\s+/u).filter(Boolean);
  const lines: string[] = [];

  for (const word of words) {
    const current = lines.at(-1);

    if (!current) {
      lines.push(word);
      continue;
    }

    if (`${current} ${word}`.length <= maxLineLength) {
      lines[lines.length - 1] = `${current} ${word}`;
      continue;
    }

    if (lines.length >= maxLines) {
      lines[lines.length - 1] = truncate(`${current} ${word}`, maxLineLength);
      continue;
    }

    lines.push(word);
  }

  return lines;
}

function initialsForName(value: string): string {
  const initials = value
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return initials || "?";
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
