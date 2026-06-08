import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

describe("Windows shortcut installer scripts", () => {
  test.each([
    "install-start-menu-shortcut.ps1",
    "install-startup-shortcut.ps1"
  ])("%s stores the resolved repository path as a string", (scriptName) => {
    const script = readFileSync(join("scripts", "windows", scriptName), "utf8");

    expect(script).toContain('$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\\..")).Path');
    expect(script).not.toContain('$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\\..")');
  });
});
