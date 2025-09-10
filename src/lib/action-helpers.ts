import { ToolContent, JSONPart, TextPart, MCPClient } from '@/types';

// Type Guards
export function isObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null;
}

export function isJSONPartLocal(p: ToolContent): p is JSONPart {
    return isObject(p) && 'type' in p && (p as { type?: unknown }).type === 'json' && 'json' in p;
}

export function isTextPartLocal(p: ToolContent): p is TextPart {
    return isObject(p) && 'type' in p && (p as { type?: unknown }).type === 'text' && 'text' in p;
}

// Content Parsers
export function getJson(content?: ToolContent[]): unknown | undefined {
    if (!content) return undefined;
    const part = content.find(isJSONPartLocal);
    return part?.json;
}

export function getText(content?: ToolContent[]): string | undefined {
    if (!content) return undefined;
    const part = content.find(isTextPartLocal);
    return part?.text;
}

// Utility Functions
export function normalizePublicId(id: string) {
    if (!id) return id;
    const parts = id.split('/');
    const last = parts.pop() || id;
    const noExt = last.replace(/\.[^/.]+$/i, '');
    parts.push(noExt);
    return parts.join('/');
}

export function parseDeleteSuccess(content?: ToolContent[], publicId?: string): boolean {
    const json = getJson(content);
    if (json && isObject(json)) {
        if (json.result === 'ok') return true;
        if (publicId && isObject(json.deleted) && json.deleted[publicId] === 'deleted') return true;
    }
    const text = getText(content);
    if (text) {
        try {
            const parsed = JSON.parse(text) as Record<string, unknown>;
            if (parsed.result === 'ok') return true;
            if (publicId && isObject(parsed.deleted) && parsed.deleted[publicId] === 'deleted') return true;
        } catch {
            if (/\bdeleted\b/i.test(text) || /\bresult\b.*\bok\b/i.test(text)) return true;
        }
    }
    return false;
}

export function extractAssetIdFromList(content: ToolContent[] | undefined, publicId: string): string | undefined {
    const from = (data: unknown): string | undefined => {
        if (!isObject(data)) return undefined;
        const list =
            (Array.isArray((data as Record<string, unknown>).resources) &&
                ((data as Record<string, unknown>).resources as unknown[])) ||
            (Array.isArray((data as Record<string, unknown>).items) &&
                ((data as Record<string, unknown>).items as unknown[])) ||
            [];
        for (const it of list) {
            if (!isObject(it)) continue;
            const r = it as Record<string, unknown>;
            const pid =
                (typeof r.public_id === 'string' && r.public_id) ||
                (typeof r.publicId === 'string' && r.publicId) ||
                '';
            if (pid === publicId) {
                const aid =
                    (typeof r.asset_id === 'string' && r.asset_id) ||
                    (typeof r.assetId === 'string' && r.assetId) ||
                    undefined;
                if (aid) return aid;
            }
        }
        return undefined;
    };

    const j = getJson(content);
    const a1 = from(j);
    if (a1) return a1;

    const t = getText(content);
    if (t) {
        try {
            return from(JSON.parse(t));
        } catch {
            /* ignore */
        }
    }
    return undefined;
}

export async function listToolNames(client: MCPClient): Promise<string[]> {
    const tools = await client.listTools?.();
    return tools?.tools?.map((t) => t.name) ?? [];
}

/* ---------- Tagging helpers ---------- */

// Accepts "tag1, tag2 tag3" and returns "tag1,tag2,tag3"
export function normalizeTagsCSV(s: string): string {
    return s
        .split(/[,\n]/)
        .flatMap(chunk => chunk.split(' '))
        .map(t => t.trim())
        .filter(Boolean)
        .join(',');
}

// Try to resolve asset_id for a given public_id
export async function getAssetIdByPublicId(
    client: MCPClient,
    publicId: string
): Promise<string | undefined> {
    // Prefer a direct lookup tool if available
    const tools = await client.listTools?.();
    const names = tools?.tools?.map(t => t.name) ?? [];
    const byPid = names.find(n =>
        ['get-resource-by-public-id', 'assets-get-resource-by-public-id'].includes(n)
    );

    if (byPid) {
        const res = await client.callTool({
            name: byPid,
            arguments: { resourceType: 'image', request: { public_id: publicId, type: 'upload' } },
        });

        const j = getJson(res?.content);
        if (j && isObject(j) && typeof j.asset_id === 'string') return j.asset_id;

        const t = getText(res?.content);
        if (t) {
            try {
                const p = JSON.parse(t) as Record<string, unknown>;
                if (typeof p.asset_id === 'string') return p.asset_id;
            } catch {
                /* ignore */
            }
        }
    }

    // Fallback to scanning list output
    const listRes = await client.callTool({ name: 'list-images', arguments: {} });
    return extractAssetIdFromList(listRes?.content, publicId);
}

// Treat common update responses as success
export function parseUpdateSuccess(content?: ToolContent[]): boolean {
    const j = getJson(content);
    if (j && isObject(j)) {
        if (j.result === 'ok') return true;
        if (Array.isArray(j.tags) || typeof j.tags === 'string') return true;
        if (typeof j.public_id === 'string') return true;
    }
    const t = getText(content);
    if (t) {
        try {
            const p = JSON.parse(t) as Record<string, unknown>;
            if (p.result === 'ok') return true;
            if (Array.isArray(p.tags) || typeof p.tags === 'string') return true;
            if (typeof p.public_id === 'string') return true;
        } catch {
            if (/\bresult\b.*\bok\b/i.test(t)) return true;
            if (/\btags\b/i.test(t) || /\bpublic_id\b/i.test(t)) return true;
        }
    }
    return false;
}
