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
            (Array.isArray(data.resources) && (data.resources as unknown[])) ||
            (Array.isArray(data.items) && (data.items as unknown[])) ||
            [];
        for (const it of list) {
            if (!isObject(it)) continue;
            const r = it as Record<string, unknown>;
            const pid = (typeof r.public_id === 'string' && r.public_id) || (typeof r.publicId === 'string' && r.publicId) || '';
            if (pid === publicId) {
                const aid = (typeof r.asset_id === 'string' && r.asset_id) || (typeof r.assetId === 'string' && r.assetId) || undefined;
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
        } catch { /* ignore */ }
    }
    return undefined;
}

export async function listToolNames(client: MCPClient): Promise<string[]> {
    const tools = await client.listTools?.();
    return tools?.tools?.map((t) => t.name) ?? [];
}