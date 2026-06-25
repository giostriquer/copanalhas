import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);

export interface FlagAsset {
  fileName: string;
  href: string;
}

const flagAssetCache = new Map<string, FlagAsset>();

export function flagAssetForTeamCode(teamCode: string): FlagAsset | undefined {
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
