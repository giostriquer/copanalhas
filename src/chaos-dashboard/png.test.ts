import { describe, expect, test } from "vitest";

import { renderChaosDashboardPng } from "./png.js";
import { renderChaosDashboardSvg } from "./svg.js";
import { sampleChaosDashboardModel } from "./test-helpers.js";

describe("chaos dashboard PNG renderer", () => {
  test("renders a non-empty PNG buffer from SVG", async () => {
    const png = await renderChaosDashboardPng(renderChaosDashboardSvg(sampleChaosDashboardModel()));

    expect(png.length).toBeGreaterThan(100);
    expect(png.subarray(1, 4).toString("ascii")).toBe("PNG");
  });
});
