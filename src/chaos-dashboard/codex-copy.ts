import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import type { GenerateChaosRecapCopy, ChaosRecapCopyArtifact, ChaosRecapCopyInput } from "./recap-copy.js";

export interface CodexRecapCopyRunRequest {
  command: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  stdin: string;
  timeoutMs: number;
}

export interface CodexRecapCopyRunResult {
  exitCode: number;
  stderr: string;
}

export interface CodexProcessSpec {
  command: string;
  args: string[];
}

export interface CodexRecapCopyProviderOptions {
  command: string;
  outputDir: string;
  schemaPath: string;
  timeoutMs: number;
  env?: NodeJS.ProcessEnv;
  runCodex?: (request: CodexRecapCopyRunRequest) => Promise<CodexRecapCopyRunResult>;
}

export function createCodexRecapCopyProvider(
  options: CodexRecapCopyProviderOptions
): GenerateChaosRecapCopy {
  const runCodex = options.runCodex ?? runCodexExec;
  const sourceEnv = options.env ?? process.env;

  return async (input) => {
    await mkdir(options.outputDir, { recursive: true });

    const outputPath = join(
      options.outputDir,
      `${safeFileSegment(input.periodKey)}-${randomUUID()}.json`
    );
    const result = await runCodex({
      command: options.command,
      args: [
        "exec",
        "-c",
        'approval_policy="never"',
        "--ephemeral",
        "--sandbox",
        "read-only",
        "--skip-git-repo-check",
        "--ignore-rules",
        "--output-schema",
        options.schemaPath,
        "-o",
        outputPath,
        "-"
      ],
      cwd: options.outputDir,
      env: sanitizedCodexEnv(sourceEnv),
      stdin: buildRecapCopyPrompt(input),
      timeoutMs: options.timeoutMs
    });

    if (result.exitCode !== 0) {
      throw new Error(`codex exec failed: ${trimForError(result.stderr)}`);
    }

    return JSON.parse(await readFile(outputPath, "utf8")) as ChaosRecapCopyArtifact;
  };
}

async function runCodexExec(
  request: CodexRecapCopyRunRequest
): Promise<CodexRecapCopyRunResult> {
  return new Promise((resolve, reject) => {
    const processSpec = createCodexProcessSpec(request);
    const child = spawn(processSpec.command, processSpec.args, {
      cwd: request.cwd,
      env: request.env,
      shell: false,
      stdio: ["pipe", "ignore", "pipe"]
    });
    let stderr = "";
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;
      child.kill();
      reject(new Error(`codex exec timed out after ${request.timeoutMs}ms`));
    }, request.timeoutMs);

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr = `${stderr}${chunk}`.slice(-4000);
    });
    child.on("error", (error) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (exitCode) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      resolve({
        exitCode: exitCode ?? 1,
        stderr
      });
    });
    child.stdin.end(request.stdin);
  });
}

export function createCodexProcessSpec(
  request: Pick<CodexRecapCopyRunRequest, "command" | "args">,
  platform: NodeJS.Platform = process.platform
): CodexProcessSpec {
  if (platform === "win32") {
    return {
      command: "cmd.exe",
      args: ["/d", "/s", "/c", request.command, ...request.args]
    };
  }

  return {
    command: request.command,
    args: [...request.args]
  };
}

function sanitizedCodexEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const allowedNames = new Set([
    "APPDATA",
    "CODEX_HOME",
    "COMSPEC",
    "HOME",
    "LOCALAPPDATA",
    "PATH",
    "PATHEXT",
    "SYSTEMROOT",
    "TEMP",
    "TMP",
    "USERPROFILE",
    "WINDIR"
  ]);
  const sanitized: NodeJS.ProcessEnv = {};

  for (const [name, value] of Object.entries(env)) {
    if (value === undefined) {
      continue;
    }

    if (allowedNames.has(name.toUpperCase())) {
      sanitized[name] = value;
    }
  }

  return sanitized;
}

function buildRecapCopyPrompt(input: ChaosRecapCopyInput): string {
  const facts = {
    periodKey: input.periodKey,
    periodLabel: input.periodLabel,
    cards: input.awards.map((award) => ({
      key: award.key,
      currentTitle: award.title,
      subject: award.subject,
      value: award.value,
      currentSubtitle: award.subtitle
    }))
  };

  return [
    "Voce escreve microcopy em portugues brasileiro para o painel Copanalhas Recap de um bolao sem dinheiro.",
    "Use humor de zoeira entre amigos, mas sem odio, xingamento pesado, dados inventados, mencoes do Discord, links ou markdown.",
    "Mantenha exatamente os mesmos keys recebidos. Reescreva apenas title e subtitle. Nao altere subject nem value.",
    "Title deve ter ate 34 caracteres. Subtitle deve ter ate 104 caracteres.",
    "Retorne somente JSON valido seguindo o schema.",
    "",
    JSON.stringify(facts, null, 2)
  ].join("\n");
}

function safeFileSegment(value: string): string {
  const normalized = value.replace(/[^a-z0-9_-]+/giu, "-").replace(/^-+|-+$/gu, "");

  return normalized || "recap";
}

function trimForError(value: string): string {
  const normalized = value.replace(/\s+/gu, " ").trim();

  return normalized || "unknown codex error";
}
