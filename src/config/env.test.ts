import { mkdtempSync, rmSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

import { loadLocalEnvFile } from "./env.js";

describe("loadLocalEnvFile", () => {
  test("loads variables from an env file into process.env", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "copanalhas-env-"));
    const envPath = join(tempRoot, ".env");
    const key = "COPANALHAS_ENV_TEST_VALUE";
    const previous = process.env[key];

    try {
      delete process.env[key];
      await writeFile(envPath, `${key}=loaded-from-test\n`, "utf8");

      loadLocalEnvFile(envPath);

      expect(process.env[key]).toBe("loaded-from-test");
    } finally {
      if (previous === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous;
      }

      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test("does nothing when the env file is missing", () => {
    expect(() => loadLocalEnvFile("./definitely-not-present.env")).not.toThrow();
  });
});
