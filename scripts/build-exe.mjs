import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import process from "node:process";

const root = process.cwd();
const distDir = join(root, "dist");
const seaConfigPath = join(root, "sea-config.json");
const bundlePath = join(distDir, "app.cjs");
const blobPath = join(distDir, "openclaw-uninstaller.blob");
const exePath = join(distDir, "openclaw-uninstaller.exe");
const packagedWebUiDir = join(distDir, "webui");
const nodeExe = process.execPath;
const npmExecCmd = process.platform === "win32" ? "npm.cmd" : "npm";

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32"
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

mkdirSync(distDir, { recursive: true });

for (const path of [bundlePath, blobPath, exePath, packagedWebUiDir]) {
  if (existsSync(path)) {
    rmSync(path, { force: true, recursive: true });
  }
}

run(npmExecCmd, [
  "exec",
  "--yes",
  "--",
  "esbuild",
  "src/index.mjs",
  "--bundle",
  "--platform=node",
  "--format=cjs",
  `--outfile=${bundlePath}`
]);

writeFileSync(
  seaConfigPath,
  JSON.stringify(
    {
      main: "dist/app.cjs",
      output: "dist/openclaw-uninstaller.blob",
      disableExperimentalSEAWarning: true
    },
    null,
    2
  ),
  "utf8"
);

run(nodeExe, ["--experimental-sea-config", seaConfigPath]);
copyFileSync(nodeExe, exePath);
run(npmExecCmd, [
  "exec",
  "--yes",
  "--",
  "postject",
  exePath,
  "NODE_SEA_BLOB",
  blobPath,
  "--sentinel-fuse",
  "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2"
]);

cpSync(join(root, "webui"), packagedWebUiDir, { recursive: true });
