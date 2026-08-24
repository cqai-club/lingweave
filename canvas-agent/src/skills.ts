import fs from "node:fs/promises";
import path from "node:path";

export type AgentSkill = { name: string; description: string; path: string; content?: string };

function skillsRoot(workspacePath: string) {
    return path.join(workspacePath, ".agents", "skills");
}

export async function listAgentSkills(workspacePath: string): Promise<AgentSkill[]> {
    const root = skillsRoot(workspacePath);
    const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
    const result: AgentSkill[] = [];
    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const file = path.join(root, entry.name, "SKILL.md");
        const content = await fs.readFile(file, "utf8").catch(() => "");
        if (!content) continue;
        result.push({ name: entry.name, description: parseDescription(content) || entry.name, path: file });
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
}

export async function readAgentSkill(workspacePath: string, name: string) {
    const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "");
    if (!safeName || safeName !== name) throw new Error("技能名称不合法");
    const file = path.join(skillsRoot(workspacePath), safeName, "SKILL.md");
    const content = await fs.readFile(file, "utf8");
    return { name: safeName, description: parseDescription(content) || safeName, path: file, content };
}

export async function writeAgentSkill(workspacePath: string, input: { name: string; description?: string; content: string }) {
    const name = input.name.trim().replace(/[^a-zA-Z0-9._-]/g, "");
    if (!name || name !== input.name.trim()) throw new Error("技能名称只能包含字母、数字、点、下划线和连字符");
    if (!input.content.trim()) throw new Error("技能内容不能为空");
    const dir = path.join(skillsRoot(workspacePath), name);
    await fs.mkdir(dir, { recursive: true });
    const content = input.content.startsWith("---") ? input.content : `---\ndescription: ${JSON.stringify(input.description || name)}\n---\n\n${input.content.trim()}\n`;
    await fs.writeFile(path.join(dir, "SKILL.md"), content, "utf8");
    return readAgentSkill(workspacePath, name);
}

export async function deleteAgentSkill(workspacePath: string, name: string) {
    const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "");
    if (!safeName || safeName !== name) throw new Error("技能名称不合法");
    await fs.rm(path.join(skillsRoot(workspacePath), safeName), { recursive: true, force: true });
}

function parseDescription(content: string) {
    const match = content.match(/^---\s*[\r\n]+([\s\S]*?)[\r\n]+---/);
    const line = match?.[1].split(/\r?\n/).find((item) => /^description\s*:/i.test(item));
    return line?.replace(/^description\s*:\s*/i, "").trim().replace(/^['"]|['"]$/g, "");
}
