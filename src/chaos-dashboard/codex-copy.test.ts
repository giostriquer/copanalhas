import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { createCodexProcessSpec, createCodexRecapCopyProvider } from "./codex-copy.js";
import type { CodexRecapCopyRunRequest } from "./codex-copy.js";
import type { ChaosPeopleAward } from "./types.js";

describe("codex recap copy provider", () => {
  test("wraps codex execution through cmd.exe on Windows", () => {
    const request: CodexRecapCopyRunRequest = {
      command: "codex",
      args: ["exec", "-"],
      cwd: "E:\\dev\\copanalhas\\data\\recap-copy",
      env: {},
      stdin: "prompt",
      timeoutMs: 1000
    };

    expect(createCodexProcessSpec(request, "win32")).toEqual({
      command: "cmd.exe",
      args: ["/d", "/s", "/c", "codex", "exec", "-"]
    });
    expect(createCodexProcessSpec(request, "linux")).toEqual({
      command: "codex",
      args: ["exec", "-"]
    });
  });

  test("runs codex exec with sanitized facts, read-only sandbox, and a schema output file", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "copanalhas-codex-copy-"));
    let request: CodexRecapCopyRunRequest | undefined;

    try {
      const provider = createCodexRecapCopyProvider({
        command: "codex",
        outputDir,
        schemaPath: join("src", "chaos-dashboard", "recap-copy.schema.json"),
        timeoutMs: 1234,
        env: {
          PATH: "C:\\bin",
          CODEX_HOME: "C:\\Users\\giova\\.codex",
          DISCORD_BOT_TOKEN: "discord-secret",
          FOOTBALL_DATA_TOKEN: "football-secret",
          OPENAI_API_KEY: "openai-secret"
        },
        runCodex: async (runRequest) => {
          request = runRequest;
          const outputPath = valueAfter(runRequest.args, "-o");

          await writeFile(
            outputPath,
            JSON.stringify({
              version: 1,
              periodKey: "group-week-1",
              cards: [
                {
                  key: "profeta-isolado",
                  title: "Oraculo do Zap",
                  subtitle: "Transformou dado bom em zoeira auditavel."
                }
              ]
            }),
            "utf8"
          );

          return { exitCode: 0, stderr: "" };
        }
      });

      const artifact = await provider({
        periodKey: "group-week-1",
        periodLabel: "Semana 1",
        awards: awards()
      });

      expect(artifact).toEqual({
        version: 1,
        periodKey: "group-week-1",
        cards: [
          {
            key: "profeta-isolado",
            title: "Oraculo do Zap",
            subtitle: "Transformou dado bom em zoeira auditavel."
          }
        ]
      });
      expect(request).toMatchObject({
        command: "codex",
        cwd: outputDir,
        timeoutMs: 1234
      });
      expect(request?.args).toEqual(
        expect.arrayContaining([
          "exec",
          "-c",
          'approval_policy="never"',
          "--ephemeral",
          "--sandbox",
          "read-only",
          "--output-schema",
          join("src", "chaos-dashboard", "recap-copy.schema.json"),
          "-o",
          expect.stringContaining(outputDir),
          "-"
        ])
      );
      expect(request?.env.PATH).toBe("C:\\bin");
      expect(request?.env.CODEX_HOME).toBe("C:\\Users\\giova\\.codex");
      expect(request?.env.DISCORD_BOT_TOKEN).toBeUndefined();
      expect(request?.env.FOOTBALL_DATA_TOKEN).toBeUndefined();
      expect(request?.env.OPENAI_API_KEY).toBeUndefined();
      expect(request?.stdin).toContain("profeta-isolado");
      expect(request?.stdin).not.toContain("discord-secret");
      expect(request?.stdin).not.toContain("football-secret");
      expect(request?.stdin).not.toContain("openai-secret");
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });

  test("throws a concise error when codex exits unsuccessfully", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "copanalhas-codex-copy-"));

    try {
      const provider = createCodexRecapCopyProvider({
        command: "codex",
        outputDir,
        schemaPath: "schema.json",
        timeoutMs: 1234,
        runCodex: async () => ({ exitCode: 2, stderr: "auth expired" })
      });

      await expect(
        provider({
          periodKey: "group-week-1",
          periodLabel: "Semana 1",
          awards: awards()
        })
      ).rejects.toThrow("auth expired");
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });
});

function valueAfter(values: readonly string[], marker: string): string {
  const index = values.indexOf(marker);
  const value = values[index + 1];

  if (!value) {
    throw new Error(`Missing ${marker} value`);
  }

  return value;
}

function awards(): ChaosPeopleAward[] {
  return [
    {
      key: "profeta-isolado",
      title: "Profeta isolado",
      subject: "Guibexa",
      value: "2 solos",
      subtitle: "Cravou sozinho e deixou a mesa olhando torto."
    }
  ];
}
