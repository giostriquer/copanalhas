import { Buffer } from "node:buffer";

import { describe, expect, test } from "vitest";

import {
  CHAOS_ATTACHMENT_NAME,
  CHAOS_DASHBOARD_TITLE,
  createChaosDashboardMessage
} from "./format.js";
import { sampleChaosDashboardModel } from "./test-helpers.js";

describe("chaos dashboard message format", () => {
  test("creates a Discord message with PNG attachment when rendering succeeds", () => {
    const png = Buffer.from("png");
    const message = createChaosDashboardMessage(sampleChaosDashboardModel(), png);

    expect(CHAOS_DASHBOARD_TITLE).toBe("Copanalhas Recap");
    expect(message.content).toContain("**Copanalhas Recap**");
    expect(message.content).toContain("Periodo: Fase de grupos - semana 1");
    expect(message.content).toContain("Zoeira estatistica");
    expect(message.embeds).toEqual([]);
    expect(message.files).toEqual([{ attachment: png, name: CHAOS_ATTACHMENT_NAME }]);
  });

  test("creates a text fallback when image rendering fails", () => {
    const message = createChaosDashboardMessage(sampleChaosDashboardModel(), null);

    expect(message.content).toContain("Imagem indisponivel no momento");
    expect(message.files).toEqual([]);
  });
});
