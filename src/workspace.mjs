import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const DEFAULT_IGNORES = new Set(["node_modules", ".git", "dist", "coverage"]);

async function walk(dir, root, results) {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(root, fullPath) || ".";

    if (entry.isDirectory()) {
      if (DEFAULT_IGNORES.has(entry.name)) {
        continue;
      }
      await walk(fullPath, root, results);
      continue;
    }

    results.push(relativePath);
  }
}

export async function listWorkspaceFiles(rootDir = process.cwd()) {
  const results = [];
  await walk(rootDir, rootDir, results);
  return results.sort((a, b) => a.localeCompare(b));
}

export async function readWorkspaceFile(filePath, rootDir = process.cwd()) {
  const resolved = path.resolve(rootDir, filePath);
  const content = await readFile(resolved, "utf8");
  return {
    path: path.relative(rootDir, resolved),
    content
  };
}

export async function searchWorkspaceText(keyword, rootDir = process.cwd()) {
  const files = await listWorkspaceFiles(rootDir);
  const matches = [];

  for (const file of files) {
    try {
      const fullPath = path.join(rootDir, file);
      const fileStat = await stat(fullPath);
      if (fileStat.size > 512 * 1024) {
        continue;
      }

      const content = await readFile(fullPath, "utf8");
      const lines = content.split(/\r?\n/);
      lines.forEach((line, index) => {
        if (line.toLowerCase().includes(keyword.toLowerCase())) {
          matches.push({
            file,
            line: index + 1,
            text: line.trim()
          });
        }
      });
    } catch {
      // Skip binary or unreadable files.
    }
  }

  return matches;
}

export function printWorkspaceSummary(files) {
  console.log(`\n当前工作区共发现 ${files.length} 个文件。\n`);
  files.slice(0, 50).forEach((file) => console.log(file));
  if (files.length > 50) {
    console.log(`... 还有 ${files.length - 50} 个文件未显示`);
  }
  console.log("");
}
