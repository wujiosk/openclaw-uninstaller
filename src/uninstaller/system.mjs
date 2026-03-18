import { spawn } from "node:child_process";

function runPowerShell(command, cwd = process.cwd()) {
  return new Promise((resolve, reject) => {
    const child = spawn("powershell", ["-NoProfile", "-Command", command], {
      cwd,
      windowsHide: true
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || stdout.trim() || `PowerShell exited with code ${code}`));
        return;
      }

      resolve(stdout.trim());
    });
  });
}

async function runPowerShellJson(command) {
  try {
    const raw = await runPowerShell(`${command} | ConvertTo-Json -Depth 5`);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

export async function collectRuntimeSignals() {
  const [processes, services, tasks] = await Promise.all([
    runPowerShellJson(
      "Get-Process | Where-Object { $_.ProcessName -like '*openclaw*' -or $_.Path -like '*openclaw*' } | Select-Object ProcessName,Id,Path"
    ),
    runPowerShellJson(
      "Get-Service | Where-Object { $_.Name -like '*openclaw*' -or $_.DisplayName -like '*openclaw*' } | Select-Object Name,DisplayName,Status"
    ),
    runPowerShellJson(
      "Get-ScheduledTask | Where-Object { $_.TaskName -like '*openclaw*' -or $_.TaskPath -like '*openclaw*' } | Select-Object TaskName,TaskPath,State"
    )
  ]);

  return { processes, services, tasks };
}
