import os from "node:os";
import path from "node:path";

export const APP_NAME = "OpenClaw Uninstaller";
export const HOST = "127.0.0.1";
export const PORT = 32123;

export const homeDir = os.homedir();
export const localAppDataDir = process.env.LOCALAPPDATA || path.join(homeDir, "AppData", "Local");
export const roamingAppDataDir =
  process.env.APPDATA || path.join(homeDir, "AppData", "Roaming");
export const desktopDir = path.join(homeDir, "Desktop");
export const startMenuProgramsDir = path.join(
  roamingAppDataDir,
  "Microsoft",
  "Windows",
  "Start Menu",
  "Programs"
);
export const nodeInstallDir = process.execPath
  ? path.dirname(process.execPath)
  : "C:\\nvm4w\\nodejs";
