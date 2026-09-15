import { execFile } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, rename, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { PROMPT_LIBRARY_SCHEMA_VERSION, validatePromptLibrary } from "./prompt-library-schema.mjs";

const execFileAsync = promisify(execFile);
const webDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = join(webDir, "public", "prompt-library");
const tempDir = outputDir + ".download";
const archivePath = tempDir + ".tar.gz";
const configuredMaxAge = Number(process.env.PROMPT_LIBRARY_MAX_AGE_HOURS);
const maxAgeHours = Number.isFinite(configuredMaxAge) && configuredMaxAge >= 0 ? configuredMaxAge : 24;
const existing = await inspectLibrary(outputDir);

if (existing.fresh) {
    console.log("提示词库已是最新快照");
} else {
    try {
        console.log(existing.usable ? "提示词库已过期，正在从上游刷新..." : "正在从上游准备提示词库...");
        await import("./sync-prompts.mjs");
    } catch (syncError) {
        if (existing.usable) {
            console.warn("上游刷新失败，继续使用上次可用快照：" + errorMessage(syncError));
        } else {
            console.warn("上游同步失败，尝试下载版本资源：" + errorMessage(syncError));
            try {
                await downloadRelease();
            } catch (releaseError) {
                await cleanupDownload();
                throw new Error("无法准备提示词库。\n上游同步：" + errorMessage(syncError) + "\n版本资源：" + errorMessage(releaseError));
            }
        }
    }
}

async function downloadRelease() {
    const version = (await readFile(resolve(webDir, "../VERSION"), "utf8")).trim();
    const url = process.env.PROMPT_LIBRARY_URL || "https://github.com/cqai-club/lingweave/releases/download/" + version + "/prompt-library.tar.gz";
    const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(120_000) });
    if (!response.ok || !response.body) throw new Error(response.status + " " + response.statusText);

    await cleanupDownload();
    await mkdir(tempDir, { recursive: true });
    await pipeline(response.body, createWriteStream(archivePath));
    await execFileAsync("tar", ["-xzf", archivePath, "-C", tempDir]);

    const extractedDir = join(tempDir, "prompt-library");
    if (!(await inspectLibrary(extractedDir)).usable) throw new Error("资源包内容不完整");
    await rm(outputDir, { recursive: true, force: true });
    await rename(extractedDir, outputDir);
    await cleanupDownload();
    console.log("已下载 " + version + " 提示词库");
}

async function inspectLibrary(directory) {
    try {
        const library = JSON.parse(await readFile(join(directory, "index.json"), "utf8"));
        const legacyLibrary = library.schemaVersion !== PROMPT_LIBRARY_SCHEMA_VERSION;
        const usable = Array.isArray(library.items) && library.items.length > 0 && (legacyLibrary || validatePromptLibrary(library).length === 0);
        const syncedAt = Date.parse(library.syncedAt || "");
        const age = Date.now() - syncedAt;
        const fresh = usable && !legacyLibrary && Number.isFinite(syncedAt) && age <= maxAgeHours * 60 * 60 * 1_000;
        return { usable, fresh };
    } catch {
        return { usable: false, fresh: false };
    }
}

async function cleanupDownload() {
    await rm(tempDir, { recursive: true, force: true });
    await rm(archivePath, { force: true });
}

function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
