import { describe, expect, test } from "vitest";

import { formatCompactTeamName, formatTeamName } from "./team-display.js";

describe("team display names", () => {
  test("formats seeded teams with pt-BR display names", () => {
    expect(formatTeamName({ code: "MEX", name: "Mexico" })).toBe("México");
    expect(formatTeamName({ code: "RSA", name: "South Africa" })).toBe("África do Sul");
    expect(formatTeamName({ code: "KOR", name: "Korea Republic" })).toBe("Coreia do Sul");
    expect(formatTeamName({ code: "CZE", name: "Czechia" })).toBe("Tchéquia");
  });

  test("uses compact pt-BR names for standings columns", () => {
    expect(formatCompactTeamName({ code: "BIH", name: "Bosnia and Herzegovina" }, 14)).toBe(
      "Bósnia e Herz."
    );
    expect(formatCompactTeamName({ code: "CIV", name: "Cote d'Ivoire" }, 14)).toBe(
      "Costa Marfim"
    );
    expect(formatCompactTeamName({ code: "USA", name: "USA" }, 14)).toBe("Estados Unidos");
  });
});
