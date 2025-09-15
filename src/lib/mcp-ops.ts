// src/lib/mcp-ops.ts
import type { MCPClient, AssetItem, CallToolResult } from '@/types';
import {
    listToolNames,
    parseDeleteSuccess,
    extractAssetIdFromList,
    getAssetIdByPublicId,
    parseUpdateSuccess,
    buildMoveTarget,
    parseCreateFolderSuccess,
} from '@/lib/action-helpers';
import { toAssetsFromContent, parseUploadResult } from '@/lib/mcp-utils';

interface ContentItem {
    type: string;
    text?: string;
    json?: unknown;
}

function readError(content?: ContentItem[]): string | undefined {
    if (!content) return;
    const t = content.find((p: ContentItem) => p?.type === 'text' && typeof p.text === 'string');
    if (t?.text) return t.text;
    const j = content.find((p: ContentItem) => p?.type === 'json' && p.json);
    if (j?.json && typeof j.json === 'object') {
        const jsonObj = j.json as Record<string, unknown>;
        const m = jsonObj.message || jsonObj.error || jsonObj.err;
        if (typeof m === 'string') return m;
    }
}

/* ------------------------------------------------------------------ */
/* Generic tool utilities                                             */
/* ------------------------------------------------------------------ */

/**
 * Pick a tool by exact name (preferred) or fuzzy regex.
 */
export async function pickTool(
    client: MCPClient,
    exactNames: string[],
    fuzzy?: RegExp,
): Promise<string | undefined> {
    const tools = await listToolNames(client);
    return (
        tools.find((n) => exactNames.includes(n)) ||
        tools.find((n) => (fuzzy ? fuzzy.test(n) : false))
    );
}

/**
 * Call a tool trying common argument envelope shapes.
 */
export async function callWithShapes(
    client: MCPClient,
    name: string,
    coreArgs: Record<string, unknown>,
) {
    const shapes = [
        { arguments: coreArgs },
        { arguments: { request: coreArgs } },
        { arguments: { requestBody: coreArgs } },
    ] as const;

    for (const s of shapes) {
        try {
            return await client.callTool({ name, ...s });
        } catch {
            // try next
        }
    }
    return undefined;
}

/* ------------------------------------------------------------------ */
/* List helpers                                                       */
/* ------------------------------------------------------------------ */

export async function listImages(client: MCPClient): Promise<AssetItem[]> {
    const res = (await client.callTool({ name: 'list-images', arguments: {} })) as CallToolResult;
    if (res.isError) {
        const msg = readError(res.content) || 'list-images failed';
        throw new Error(msg);
    }
    return toAssetsFromContent(res?.content || []) || [];
}

export function toFolderItems(folders: string[], limit = 5): AssetItem[] {
    return folders.slice(0, limit).map((f) => ({
        id: f,
        folder: f,
        resourceType: undefined, // UI treats as 📁
    }));
}

export function uniqueTopFoldersFromAssets(
    assets: AssetItem[],
    base?: string,
    limit = 5,
): string[] {
    const out = new Set<string>();
    const baseNorm = (base || '').replace(/^\/+|\/+$/g, '');
    const basePrefix = baseNorm ? `${baseNorm}/` : '';

    for (const a of assets) {
        let path = a.folder;
        if (!path) {
            const idNoExt = a.id.replace(/\.[^/.]+$/i, '');
            const slash = idNoExt.lastIndexOf('/');
            path = slash > 0 ? idNoExt.slice(0, slash) : '';
        }
        if (!path) continue;

        if (baseNorm) {
            if (!path.startsWith(basePrefix) || path === baseNorm) continue;
            const rest = path.slice(basePrefix.length);
            const top = rest.split('/')[0];
            if (top) out.add(`${baseNorm}/${top}`);
        } else {
            const top = path.split('/')[0];
            if (top) out.add(top);
        }
        if (out.size >= limit) break;
    }
    return Array.from(out).slice(0, limit);
}

export function extractFoldersFromContent(content?: unknown): string[] {
    if (!Array.isArray(content)) return [];
    const pick = (data: unknown): string[] => {
        if (!data || typeof data !== 'object') return [];
        const d = data as { folders?: unknown[]; sub_folders?: unknown[]; items?: unknown[] };
        const arr =
            (Array.isArray(d.folders) && d.folders) ||
            (Array.isArray(d.sub_folders) && d.sub_folders) ||
            (Array.isArray(d.items) && d.items) ||
            [];
        const out: string[] = [];
        for (const it of arr) {
            if (!it || typeof it !== 'object') continue;
            const o = it as { path?: unknown; name?: unknown };
            const name =
                (typeof o.path === 'string' && o.path) ||
                (typeof o.name === 'string' && o.name) ||
                '';
            if (name) out.push(name);
            if (out.length >= 5) break;
        }
        return out;
    };

    const jsonPart = content.find(
        (p: unknown): p is { type: string; json: unknown } =>
            !!p && typeof p === 'object' && (p as { type?: string }).type === 'json' && 'json' in (p as object),
    );
    if (jsonPart) return pick(jsonPart.json);

    const textPart = content.find(
        (p: unknown): p is { type: string; text: string } =>
            !!p && typeof p === 'object' && (p as { type?: string }).type === 'text' && typeof (p as { text?: unknown }).text === 'string',
    );
    if (textPart) {
        try {
            return pick(JSON.parse(textPart.text));
        } catch {
            /* ignore */
        }
    }
    return [];
}

export async function listFolders(
    client: MCPClient,
    base?: string,
    limit = 5,
): Promise<AssetItem[] | null> {
    const listTool = await pickTool(
        client,
        ['list-folders', 'folders-list', 'assets-list-folders', 'list-subfolders'],
        /folders?.-?list|list-?folders?|sub.?folders/i,
    );

    if (listTool) {
        const path = (base || '').trim().replace(/^\/+|\/+$/g, '');
        const res = await callWithShapes(client, listTool, path ? { path } : {});
        const folders = extractFoldersFromContent(res?.content);
        if (folders.length) return toFolderItems(folders, limit);
    }

    // Fallback: infer from images
    const assets = await listImages(client);
    const top = uniqueTopFoldersFromAssets(assets, base, limit);
    return top.length ? toFolderItems(top, limit) : null;
}

/* ------------------------------------------------------------------ */
/* File & asset operations                                            */
/* ------------------------------------------------------------------ */

export async function uploadFileToFolder(
    client: MCPClient,
    file: File,
    folder = 'chat_uploads',
): Promise<AssetItem | null> {
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString('base64');
    const mime = file.type || 'application/octet-stream';
    const dataUri = `data:${mime};base64,${base64}`;

    const res = await client.callTool({
        name: 'upload-asset',
        arguments: { uploadRequest: { file: dataUri, fileName: file.name, folder } },
    });

    return parseUploadResult(res?.content) || null;
}

export async function renameByPublicId(
    client: MCPClient,
    from_public_id: string,
    to_public_id: string,
): Promise<AssetItem | null> {
    const res = await client.callTool({
        name: 'asset-rename',
        arguments: { resourceType: 'image', requestBody: { from_public_id, to_public_id } },
    });
    return parseUploadResult(res?.content) || null;
}

export async function moveToFolder(
    client: MCPClient,
    from_public_id: string,
    folder: string,
): Promise<AssetItem | null> {
    const to_public_id = buildMoveTarget(folder, from_public_id);
    return renameByPublicId(client, from_public_id, to_public_id);
}

export async function deleteByPublicId(client: MCPClient, public_id: string): Promise<boolean> {
    const bulkTool = await pickTool(client, [
        'assets-delete-resources-by-public-id',
        'delete-resources-by-public-id',
        'assets-delete',
    ]);

    let res: CallToolResult | undefined;
    if (bulkTool) {
        res = await client.callTool({
            name: bulkTool,
            arguments: { resourceType: 'image', request: { public_ids: [public_id], type: 'upload' } },
        });
        return parseDeleteSuccess(res?.content, public_id);
    }

    const listRes = await client.callTool({ name: 'list-images', arguments: {} });
    const assetId = extractAssetIdFromList(listRes?.content, public_id);
    if (!assetId) return false;

    res = await client.callTool({
        name: 'delete-asset',
        arguments: { resourceType: 'image', request: { asset_id: assetId, invalidate: true } },
    });
    return parseDeleteSuccess(res?.content, public_id);
}

export async function tagByPublicId(
    client: MCPClient,
    public_id: string,
    tagsCsv: string,
): Promise<{ ok: boolean; asset?: AssetItem }> {
    const updateByPid = await pickTool(client, [
        'update-resource-by-public-id',
        'assets-update-resource-by-public-id',
    ]);

    if (updateByPid) {
        const res = await client.callTool({
            name: updateByPid,
            arguments: { resourceType: 'image', request: { public_id, type: 'upload', tags: tagsCsv } },
        });
        return { ok: parseUpdateSuccess(res?.content), asset: parseUploadResult(res?.content) || undefined };
    }

    const assetId = await getAssetIdByPublicId(client, public_id);
    if (!assetId) return { ok: false };

    const res = await client.callTool({
        name: 'asset-update',
        arguments: { assetId, resourceUpdateRequest: { tags: tagsCsv } },
    });
    return { ok: parseUpdateSuccess(res?.content), asset: parseUploadResult(res?.content) || undefined };
}

export async function createFolder(client: MCPClient, folderPath: string): Promise<boolean> {
    const tool = await pickTool(client, ['create-folder', 'folders-create-folder']);
    if (!tool) return false;

    const res = await callWithShapes(client, tool, { folder: folderPath });
    return parseCreateFolderSuccess(res?.content);
}
