import { mkdirSync, copyFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import process from "node:process";

const root = process.cwd();
const distDir = join(root, "dist");
const seaConfigPath = join(root, "sea-config.json");
const bundlePath = join(distDir, "app.cjs");
const blobPath = join(distDir, "claw.blob");
const exePath = join(distDir, "claw.exe");
const nodeExe = process.execPath;
const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: false
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

mkdirSync(distDir, { recursive: true });

run(npxCmd, [
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
      output: "dist/claw.blob",
      disableExperimentalSEAWarning: true
    },
    null,
    2
  ),
  "utf8"
);

run(process.execPath, ["--experimental-sea-config", seaConfigPath]);
copyFileSync(nodeExe, exePath);
run(npxCmd, [
  "postject",
  exePath,
  "NODE_SEA_BLOB",
  blobPath,
  "--sentinel-fuse",
  "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2"
]);
