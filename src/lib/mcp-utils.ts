// src/lib/mcp-utils.ts

import { AssetItem, ToolContent, JSONPart, TextPart } from '@/types';

function isObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null;
}
function isJSONPart(p: ToolContent): p is JSONPart {
    return isObject(p) && p.type === 'json' && 'json' in p;
}
function isTextPart(p: ToolContent): p is TextPart {
    return isObject(p) && p.type === 'text' && typeof p.text === 'string';
}

function cleanUrl(u?: string): string | undefined {
    if (!u || typeof u !== 'string') return undefined;
    const trimmed = u.split(/[\s"']/)[0] ?? u;
    try {
        const parsedUrl = new URL(trimmed);
        parsedUrl.protocol = 'https';
        return parsedUrl.toString();
    } catch {
        return undefined;
    }
}

/* ---------- Safe getters (no any) ---------- */
function getString(
    o: Record<string, unknown>,
    keys: string[],
): string | undefined {
    for (const k of keys) {
        const v = o[k];
        if (typeof v === 'string' && v.length) return v;
    }
    return undefined;
}

function getNumber(
    o: Record<string, unknown>,
    keys: string[],
): number | undefined {
    for (const k of keys) {
        const v = o[k];
        if (typeof v === 'number' && Number.isFinite(v)) return v;
    }
    return undefined;
}

function getArray(
    o: Record<string, unknown>,
    keys: string[],
): unknown[] | undefined {
    for (const k of keys) {
        const v = o[k];
        if (Array.isArray(v)) return v as unknown[];
    }
    return undefined;
}

function getStringArray(
    o: Record<string, unknown>,
    keys: string[],
): string[] | undefined {
    // Accept array or comma/space separated string
    const arr = getArray(o, keys);
    if (arr) {
        const out = arr.filter((t): t is string => typeof t === 'string').map((t) => t.trim()).filter(Boolean);
        return out.length ? out : undefined;
    }
    const s = getString(o, keys);
    if (s) {
        const out = s
            .split(/[,\s]+/)
            .map((t) => t.trim())
            .filter(Boolean);
        return out.length ? out : undefined;
    }
    return undefined;
}

function deriveFolderFromPublicId(pid?: string): string | undefined {
    if (!pid) return undefined;
    const parts = pid.split('/');
    if (parts.length <= 1) return undefined;
    parts.pop();
    return parts.join('/');
}

function inferResourceType(
    ro: Record<string, unknown>,
    url?: string,
): AssetItem['resourceType'] {
    const rt = getString(ro, ['resourceType', 'resource_type']);
    if (rt === 'image' || rt === 'video' || rt === 'raw') return rt;
    if (url?.includes('/video/upload/')) return 'video';
    if (url?.includes('/image/upload/')) return 'image';
    return undefined;
}

/** Extract assets from MCP content */
export function toAssetsFromContent(content: ToolContent[]): AssetItem[] | null {
    let data: unknown = content.find(isJSONPart)?.json;
    if (!data) {
        const t = content.find(isTextPart)?.text;
        if (t && t.includes('{')) {
            try {
                data = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
            } catch {
                /* ignore */
            }
        }
    }

    if (!isObject(data)) return null;

    const rdata = data as Record<string, unknown>;
    const items =
        (getArray(rdata, ['resources']) as Record<string, unknown>[] | undefined) ||
        (getArray(rdata, ['items']) as Record<string, unknown>[] | undefined) ||
        [];

    const out: AssetItem[] = [];

    for (const ro of items.slice(0, 5)) {
        if (!isObject(ro)) continue;

        const publicId = getString(ro, ['publicId', 'public_id']);
        const assetId = getString(ro, ['asset_id', 'assetId']);
        const finalId = publicId || assetId || crypto.randomUUID();

        const url = cleanUrl(
            getString(ro, ['secureUrl', 'secure_url', 'url']),
        );

        const createdAt = getString(ro, ['createdAt', 'created_at']);
        const format = getString(ro, ['format']);
        const width = getNumber(ro, ['width']);
        const height = getNumber(ro, ['height']);

        const folderExplicit = getString(ro, ['folder']);
        const folder = folderExplicit ?? deriveFolderFromPublicId(publicId);

        const tags = getStringArray(ro, ['tags']);

        const thumbUrl =
            url && url.includes('/image/upload/')
                ? url.replace(
                    '/image/upload/',
                    '/image/upload/c_fill,w_160,h_160,q_auto,f_auto/',
                )
                : url;

        out.push({
            id: finalId,
            url,
            thumbUrl,
            folder: folder || undefined,
            createdAt,
            format,
            width,
            height,
            resourceType: inferResourceType(ro, url),
            tags,
        });
    }

    return out.length ? out : null;
}

/** Extract uploaded asset info (also used after update/rename/move) */
export function parseUploadResult(content?: ToolContent[]): AssetItem | null {
    if (!content || !Array.isArray(content)) return null;
    let data: unknown = null;

    const textPart = content.find(isTextPart);
    if (textPart?.text) {
        try {
            data = JSON.parse(textPart.text);
        } catch {
            return null;
        }
    } else {
        const jsonPart = content.find(isJSONPart);
        if (jsonPart?.json) data = jsonPart.json;
    }

    if (!isObject(data)) return null;
    const ro = data as Record<string, unknown>;

    const basePublicId = getString(ro, ['publicId', 'public_id']);
    const folderExplicit = getString(ro, ['folder']);
    const folder =
        folderExplicit ?? (deriveFolderFromPublicId(basePublicId || undefined)) ?? null;

    const fullPublicId =
        basePublicId &&
        (basePublicId.includes('/')
            ? basePublicId
            : folder
                ? `${folder}/${basePublicId}`
                : basePublicId);

    const assetId = getString(ro, ['assetId', 'asset_id']);
    const finalId = fullPublicId || assetId || crypto.randomUUID();

    const url = cleanUrl(getString(ro, ['secureUrl', 'secure_url', 'url']));
    const createdAt = getString(ro, ['createdAt', 'created_at']);
    const format = getString(ro, ['format']);
    const width = getNumber(ro, ['width']);
    const height = getNumber(ro, ['height']);
    const tags = getStringArray(ro, ['tags']);

    if (!url) return null;

    return {
        id: finalId,
        url,
        thumbUrl: url,
        folder: folder || undefined,
        createdAt,
        format,
        width,
        height,
        resourceType: inferResourceType(ro, url),
        tags,
    };
}
