import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { assertPromptLibrary } from "./prompt-library-schema.mjs";

const webDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const indexPath = resolve(webDir, "public/prompt-library/index.json");
const library = JSON.parse(await readFile(indexPath, "utf8"));

assertPromptLibrary(library);
console.log("提示词库校验通过：" + library.total + " 条，" + library.sources.length + " 个来源");
