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
        if ((json as Record<string, unknown>).result === 'ok') return true;
        if (
            publicId &&
            isObject((json as Record<string, unknown>).deleted) &&
            (isObject((json as Record<string, unknown>).deleted) &&
                (json as { deleted: Record<string, unknown> }).deleted[publicId] === 'deleted')
        ) {
            return true;
        }
    }
    const text = getText(content);
    if (text) {
        try {
            const parsed = JSON.parse(text) as Record<string, unknown>;
            if (parsed.result === 'ok') return true;
            if (
                publicId &&
                isObject(parsed.deleted) &&
                typeof (parsed.deleted as Record<string, unknown>)[publicId] === 'string' &&
                (parsed.deleted as Record<string, unknown>)[publicId] === 'deleted'
            ) {
                return true;
            }
        } catch {
            if (/\bdeleted\b/i.test(text) || /\bresult\b.*\bok\b/i.test(text)) return true;
        }
    }
    return false;
}

export function extractAssetIdFromList(
    content: ToolContent[] | undefined,
    publicId: string,
): string | undefined {
    const from = (data: unknown): string | undefined => {
        if (!isObject(data)) return undefined;
        const obj = data as Record<string, unknown>;
        const list =
            (Array.isArray(obj.resources) && (obj.resources as unknown[])) ||
            (Array.isArray(obj.items) && (obj.items as unknown[])) ||
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
        .flatMap((chunk) => chunk.split(' '))
        .map((t) => t.trim())
        .filter(Boolean)
        .join(',');
}

// Try to resolve asset_id for a given public_id
export async function getAssetIdByPublicId(
    client: MCPClient,
    publicId: string,
): Promise<string | undefined> {
    const tools = await client.listTools?.();
    const names = tools?.tools?.map((t) => t.name) ?? [];
    const byPid = names.find((n) =>
        ['get-resource-by-public-id', 'assets-get-resource-by-public-id'].includes(n),
    );

    if (byPid) {
        const res = await client.callTool({
            name: byPid,
            arguments: { resourceType: 'image', request: { public_id: publicId, type: 'upload' } },
        });

        const j = getJson(res?.content);
        if (j && isObject(j) && typeof (j as Record<string, unknown>).asset_id === 'string') {
            return (j as Record<string, string>).asset_id;
        }

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

    const listRes = await client.callTool({ name: 'list-images', arguments: {} });
    return extractAssetIdFromList(listRes?.content, publicId);
}

// Treat common update responses as success
export function parseUpdateSuccess(content?: ToolContent[]): boolean {
    const j = getJson(content);
    if (j && isObject(j)) {
        const o = j as Record<string, unknown>;
        if (o.result === 'ok') return true;
        if (Array.isArray(o.tags) || typeof o.tags === 'string') return true;
        if (typeof o.public_id === 'string') return true;
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

// Join folder and basename of a public_id
export function baseNameFromPublicId(pid: string): string {
    const clean = pid.replace(/\.[^/.]+$/i, '');
    const parts = clean.split('/');
    return parts[parts.length - 1] || clean;
}

export function buildMoveTarget(folder: string, publicId: string): string {
    const f = folder.replace(/^\/+|\/+$/g, '');
    return `${f}/${baseNameFromPublicId(publicId)}`;
}

export function parseCreateFolderSuccess(content?: ToolContent[]): boolean {
    const j = getJson(content);
    if (j && isObject(j)) {
        const o = j as Record<string, unknown>;
        if (o.result === 'ok') return true;
        if (o.success === true) return true;
        if (typeof o.path === 'string' || typeof o.name === 'string') return true;
    }
    const t = getText(content);
    if (t) {
        try {
            const p = JSON.parse(t) as Record<string, unknown>;
            if (p.result === 'ok' || p.success === true) return true;
            if (typeof p.path === 'string' || typeof p.name === 'string') return true;
        } catch {
            if (/\bresult\b.*\bok\b/i.test(t) || /\bsuccess\b\s*:\s*true/i.test(t)) return true;
            if (/\bpath\b/i.test(t) || /\bname\b/i.test(t)) return true;
        }
    }
    return false;
}

export function parseFoldersFromContent(content?: ToolContent[]): string[] {
    const out: string[] = [];
    const from = (data: unknown) => {
        if (!data || typeof data !== 'object') return;
        const o = data as Record<string, unknown>;
        const arr =
            (Array.isArray(o.folders) && (o.folders as unknown[])) ||
            (Array.isArray(o.items) && (o.items as unknown[])) ||
            [];
        for (const it of arr) {
            if (!it || typeof it !== 'object') continue;
            const r = it as Record<string, unknown>;
            const name =
                (typeof r.path === 'string' && r.path) ||
                (typeof r.name === 'string' && r.name) ||
                (typeof r.folder === 'string' && r.folder);
            if (name) out.push(name);
        }
    };

    const j = getJson(content);
    if (j) from(j);

    const t = getText(content);
    if (t) {
        try {
            from(JSON.parse(t));
        } catch {
            /* ignore */
        }
    }

    return out;
}
