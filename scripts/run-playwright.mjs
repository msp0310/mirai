#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const environment = { ...process.env };
delete environment.NO_COLOR;

const command = process.platform === "win32" ? "playwright.cmd" : "playwright";
const result = spawnSync(command, process.argv.slice(2), {
  env: environment,
  shell: process.platform === "win32",
  stdio: "inherit",
});

if (result.error) {
  throw result.error;
}

process.exitCode = result.status ?? 1;
