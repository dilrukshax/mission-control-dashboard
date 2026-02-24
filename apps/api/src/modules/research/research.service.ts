import fs from "node:fs";
import path from "node:path";
import { slugify, dateOnly, nowIso } from "../../lib/utils.js";

export function getMarkdownFiles(rootDir: string): string[] {
    const out: string[] = [];
    function walk(current: string) {
        const entries = fs.readdirSync(current, { withFileTypes: true });
        for (const e of entries) {
            if (e.name.startsWith(".")) continue;
            const full = path.join(current, e.name);
            if (e.isDirectory()) walk(full);
            else if (e.isFile() && e.name.toLowerCase().endsWith(".md")) out.push(full);
        }
    }
    if (fs.existsSync(rootDir)) walk(rootDir);
    return out;
}

export function tokenizeQuery(query: string): string[] {
    return query.toLowerCase().split(/\s+/).map((s) => s.trim()).filter((s) => s.length > 1);
}

export function scoreText(content: string, query: string, relPath = ""): number {
    const q = tokenizeQuery(query);
    const body = content.toLowerCase();
    const title = (content.match(/^#\s+(.+)$/m)?.[1] ?? "").toLowerCase();
    const pathText = relPath.toLowerCase();

    let score = 0;
    for (const token of q) {
        let idx = body.indexOf(token);
        while (idx !== -1) {
            score += 1;
            idx = body.indexOf(token, idx + token.length);
        }
        if (title.includes(token)) score += 6;
        if (pathText.includes(token)) score += 4;
        if (query.length > 8 && body.includes(query.toLowerCase())) score += 8;
    }
    return score;
}

export function summarizeMatch(content: string, query: string): string {
    const lower = content.toLowerCase();
    const token = query.toLowerCase().split(/\s+/).map((s) => s.trim()).find((s) => s.length > 1);
    const idx = token ? lower.indexOf(token) : -1;
    if (idx === -1) return content.replace(/\s+/g, " ").slice(0, 220);
    const start = Math.max(0, idx - 120);
    const end = Math.min(content.length, idx + 180);
    return content.slice(start, end).replace(/\s+/g, " ");
}

export function searchNotesInRoots(obsidianRoot: string, query: string, roots: string[]) {
    return roots
        .flatMap((root) => {
            const abs = path.join(obsidianRoot, root);
            return getMarkdownFiles(abs);
        })
        .map((file) => {
            const relPath = path.relative(obsidianRoot, file);
            const content = fs.readFileSync(file, "utf8");
            const score = scoreText(content, query, relPath);
            return { relPath, score, snippet: summarizeMatch(content, query) };
        })
        .filter((m) => m.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 4);
}

export function createChannelNote(obsidianRoot: string, folder: string, title: string, requester: string, text: string): string {
    const fileName = `${dateOnly()} - ${slugify(title)}.md`;
    const relPath = path.join(folder, fileName);
    const absPath = path.join(obsidianRoot, relPath);
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    const body = `# ${title}\n\n- Date: ${nowIso()}\n- Requester: ${requester}\n\n## Context\n${text}\n\n## Notes\n- \n`;
    fs.writeFileSync(absPath, body, "utf8");
    return relPath;
}
