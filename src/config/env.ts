import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

export function loadLocalEnvFile(path = ".env"): void {
  if (!existsSync(path)) {
    return;
  }

  loadEnvFile(path);
}
