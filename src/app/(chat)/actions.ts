'use server';

import { ChatMessage, MCPClient, CallToolResult, AssetItem } from '@/types';
import { connectCloudinary } from '@/lib/mcp-client';
import { toAssetsFromContent, parseUploadResult } from '@/lib/mcp-utils';
import {
    normalizePublicId,
    parseDeleteSuccess,
    extractAssetIdFromList,
    listToolNames,
    normalizeTagsCSV,
    getAssetIdByPublicId,
    parseUpdateSuccess,
    buildMoveTarget,
    parseCreateFolderSuccess,
} from '@/lib/action-helpers';

export async function sendMessageAction(
    previousState: ChatMessage[] | null,
    formData: FormData,
): Promise<ChatMessage[]> {
    const currentState = previousState ?? [];
    const file = formData.get('file');
    const text = (formData.get('text') as string) || '';

    const userMessage: ChatMessage = {
        id: formData.get('id') as string,
        role: 'user',
        text: text || `Uploading ${formData.get('fileName') as string}...`,
    };

    const lastAssetId = formData.get('lastAssetId') as string | null;

    let client: MCPClient | undefined;
    try {
        client = (await connectCloudinary('asset-management')) as unknown as MCPClient;
        let assistantMsg: ChatMessage | null = null;

        if (file instanceof File) {
            // --- Upload ---
            const buffer = Buffer.from(await file.arrayBuffer());
            const base64 = buffer.toString('base64');
            const mime = file.type || 'application/octet-stream';
            const dataUri = `data:${mime};base64,${base64}`;

            const res = await client.callTool({
                name: 'upload-asset',
                arguments: {
                    uploadRequest: { file: dataUri, fileName: file.name, folder: 'chat_uploads' },
                },
            });

            const uploaded = parseUploadResult(res?.content);
            assistantMsg = {
                id: crypto.randomUUID(),
                role: 'assistant',
                text: uploaded ? 'Image uploaded successfully.' : 'Upload complete.',
                assets: uploaded ? [uploaded] : undefined,
            };
        } else {
            // --- Text commands ---
            const wantList =
                /^(list|show)\s+(images|pics|photos?)$/i.test(text) || /^images?$/i.test(text);

            // NEW: list images in <folder>
            const listImagesInMatch = text.match(
                /^(list|show)\s+(images|assets|files|photos?)\s+(in|from|under|inside)\s+(.+)$/i,
            );

            // NEW: list folders (optionally in <folder>)
            const listFoldersOnly = /^(list|show)\s+folders$/i.test(text);
            const listFoldersInMatch = text.match(/^(list|show)\s+folders\s+(in|under|inside)\s+(.+)$/i);

            const renameLastMatch = text.match(/^rename the above image to\s+(.+)$/i);
            const renameMatch = text.match(/^rename\s+(.+?)\s+to\s+(.+)$/i);
            const deleteLastMatch = text.match(/^delete the above image$/i);
            const deleteMatch = text.match(/^delete\s+(.+)$/i);

            const tagLastMatch = text.match(/^tag the above image with\s+(.+)$/i);
            const tagMatch = text.match(/^tag\s+(.+?)\s+with\s+(.+)$/i);

            // Folder commands
            const createFolderMatch = text.match(/^(create|make)\s+folder\s+(.+)$/i);
            const moveLastMatch = text.match(/^move the above image to\s+(.+)$/i);
            const moveMatch = text.match(/^move\s+(.+?)\s+to\s+(.+)$/i);

            // Helper: build top N folders from assets (client-side fallback)
            const uniqueTopFoldersFromAssets = (
                assets: AssetItem[],
                base?: string,
                limit = 5,
            ): string[] => {
                const set = new Set<string>();
                const baseNorm = (base || '').replace(/^\/+|\/+$/g, '');
                const basePrefix = baseNorm ? `${baseNorm}/` : '';

                for (const a of assets) {
                    // derive the asset’s folder path
                    let path = a.folder;
                    if (!path) {
                        const idNoExt = a.id.replace(/\.[^/.]+$/i, '');
                        const slash = idNoExt.lastIndexOf('/');
                        path = slash > 0 ? idNoExt.slice(0, slash) : '';
                    }
                    if (!path) continue; // ignore “No folder”

                    if (baseNorm) {
                        if (path === baseNorm) continue;
                        if (!path.startsWith(basePrefix)) continue;
                        const rest = path.slice(basePrefix.length);
                        const top = rest.split('/')[0];
                        if (top) set.add(`${baseNorm}/${top}`);
                    } else {
                        const top = path.split('/')[0];
                        if (top) set.add(top);
                    }
                    if (set.size >= limit) break;
                }
                return Array.from(set).slice(0, limit);
            };

            // Helper: map folder paths into folder AssetItems (so UI shows 📁)
            const toFolderItems = (folders: string[]): AssetItem[] =>
                folders.map((f) => ({
                    id: f,
                    folder: f,
                    // resourceType: 'folder', // 'folder' is not a valid AssetItem resourceType, so omit or set undefined
                    resourceType: undefined,
                }));

            // Helper: try a wide set of list-folders tool names, else fallback
            const tryListFolders = async (base?: string): Promise<AssetItem[] | null> => {
                const tools = await listToolNames(client!);
                const byExact = tools.find((n) =>
                    ['list-folders', 'folders-list', 'assets-list-folders', 'list-subfolders'].includes(n),
                );
                const byLoose = tools.find((n) => /folders?.-?list|list-?folders?|sub.?folders/i.test(n));
                const listTool = byExact || byLoose;

                // parse folders from tool content
                const extractFolders = (content?: unknown): string[] => {
                    if (!content) return [];
                    const pick = (data: unknown): string[] => {
                        if (!data || typeof data !== 'object') return [];
                        type FolderData = { folders?: unknown[]; sub_folders?: unknown[]; items?: unknown[] };
                        const d = data as Partial<FolderData>;
                        const arr =
                            (Array.isArray(d.folders) && d.folders) ||
                            (Array.isArray(d.sub_folders) && d.sub_folders) ||
                            (Array.isArray(d.items) && d.items) ||
                            [];
                        const out: string[] = [];
                        for (const it of arr) {
                            if (!it || typeof it !== 'object') continue;
                            // Use a more specific type guard instead of 'any'
                            const maybeObj = it as { path?: unknown; name?: unknown };
                            const name =
                                (typeof maybeObj.path === 'string' && maybeObj.path) ||
                                (typeof maybeObj.name === 'string' && maybeObj.name) ||
                                '';
                            if (name) out.push(name);
                            if (out.length >= 5) break;
                        }
                        return out;
                    };

                    // content may be [{type:'json', json:{...}}] or [{type:'text', text:'...json...'}]
                    const jsonPart = Array.isArray(content)
                        ? content.find((p): p is { type: string; json: unknown } => typeof p === 'object' && p !== null && p.type === 'json' && 'json' in p)
                        : undefined;
                    if (jsonPart) return pick(jsonPart.json);

                    const textPart = Array.isArray(content)
                        ? content.find(
                            (p): p is { type: string; text: string } =>
                                typeof p === 'object' &&
                                p !== null &&
                                p.type === 'text' &&
                                typeof (p as { text?: unknown }).text === 'string'
                        )
                        : undefined;
                    if (textPart) {
                        try {
                            return pick(JSON.parse(textPart.text));
                        } catch {
                            return [];
                        }
                    }
                    return [];
                };

                // Try tool if present
                if (listTool) {
                    const path = (base || '').trim().replace(/^\/+|\/+$/g, '');
                    const shapes = [
                        { arguments: path ? { path } : {} },
                        { arguments: path ? { folder: path } : {} },
                        { arguments: path ? { request: { path } } : {} },
                        { arguments: path ? { requestBody: { path } } : {} },
                    ] as const;

                    for (const s of shapes) {
                        try {
                            const res = await client!.callTool({ name: listTool, ...s });
                            const folders = extractFolders(res?.content);
                            if (folders.length) return toFolderItems(folders.slice(0, 5));
                        } catch {
                            // try the next shape
                        }
                    }
                    // tool exists but didn’t give folders → fall through to client fallback
                }

                // Fallback: derive from images
                try {
                    const res = await client!.callTool({ name: 'list-images', arguments: {} });
                    const assets = toAssetsFromContent(res?.content || []) || [];
                    const top = uniqueTopFoldersFromAssets(assets, base, 5);
                    if (top.length) return toFolderItems(top);
                } catch {
                    // ignore
                }
                return null;
            };

            if (listImagesInMatch) {
                // --- List images in a given folder (robust client-side filter) ---
                const folder = listImagesInMatch[4].trim().replace(/^\/+|\/+$/g, '');
                const res = await client.callTool({ name: 'list-images', arguments: {} });
                const all = toAssetsFromContent(res?.content || []) || [];
                const filtered = all.filter(
                    (a) => a.folder === folder || a.id.replace(/\.[^/.]+$/i, '').startsWith(`${folder}/`),
                );
                assistantMsg = {
                    id: crypto.randomUUID(),
                    role: 'assistant',
                    text: `Images in "${folder}":`,
                    assets: filtered.slice(0, 5),
                };

            } else if (listFoldersOnly || listFoldersInMatch) {
                // --- List folders (root or under a base path) ---
                const base =
                    (listFoldersInMatch ? listFoldersInMatch[3] : '').trim().replace(/^\/+|\/+$/g, '') || undefined;
                const folders = await tryListFolders(base);

                assistantMsg = folders && folders.length
                    ? {
                        id: crypto.randomUUID(),
                        role: 'assistant',
                        text: base ? `Folders under "${base}":` : 'Folders:',
                        assets: folders,
                    }
                    : {
                        id: crypto.randomUUID(),
                        role: 'assistant',
                        text: 'No folders found.',
                    };

            } else if (wantList) {
                // --- List recent images ---
                const res = await client.callTool({ name: 'list-images', arguments: {} });
                const assets = toAssetsFromContent(res?.content || []);
                assistantMsg = {
                    id: crypto.randomUUID(),
                    role: 'assistant',
                    text: assets?.length ? 'Here are your latest images:' : 'No images found.',
                    assets: assets ?? undefined,
                };

            } else if (renameLastMatch && lastAssetId) {
                // Rename above
                const from_public_id = lastAssetId;
                const to_public_id = renameLastMatch[1].trim();
                const res = await client.callTool({
                    name: 'asset-rename',
                    arguments: { resourceType: 'image', requestBody: { from_public_id, to_public_id } },
                });

                const renamedAsset = parseUploadResult(res?.content);
                assistantMsg = renamedAsset
                    ? {
                        id: crypto.randomUUID(),
                        role: 'assistant',
                        text: `Successfully renamed asset to "${to_public_id}".`,
                        assets: [renamedAsset],
                    }
                    : {
                        id: crypto.randomUUID(),
                        role: 'assistant',
                        text: `Could not rename asset. The ID "${from_public_id}" may no longer be valid.`,
                    };

            } else if (deleteLastMatch && lastAssetId) {
                // Delete above
                const public_id = normalizePublicId(lastAssetId);
                const toolNames = await listToolNames(client);
                const bulkTool = toolNames.find((n) =>
                    ['assets-delete-resources-by-public-id', 'delete-resources-by-public-id', 'assets-delete'].includes(n),
                );
                let res: CallToolResult | undefined;

                if (bulkTool) {
                    res = await client.callTool({
                        name: bulkTool,
                        arguments: { resourceType: 'image', request: { public_ids: [public_id], type: 'upload' } },
                    });
                } else {
                    const listRes = await client.callTool({ name: 'list-images', arguments: {} });
                    const assetId = extractAssetIdFromList(listRes?.content, public_id);
                    if (!assetId) {
                        return [
                            ...currentState,
                            userMessage,
                            { id: crypto.randomUUID(), role: 'assistant', text: `Could not find asset_id for "${public_id}".` },
                        ];
                    }
                    res = await client.callTool({
                        name: 'delete-asset',
                        arguments: { resourceType: 'image', request: { asset_id: assetId, invalidate: true } },
                    });
                }

                const ok = parseDeleteSuccess(res?.content, public_id);
                assistantMsg = ok
                    ? { id: crypto.randomUUID(), role: 'assistant', text: `Deleted ${public_id}.` }
                    : { id: crypto.randomUUID(), role: 'assistant', text: `Failed to delete "${public_id}". It may not exist.` };

            } else if (tagLastMatch && lastAssetId) {
                // Tag above
                const public_id = normalizePublicId(lastAssetId);
                const tagsCsv = normalizeTagsCSV(tagLastMatch[1]);
                const toolNames = await listToolNames(client);
                const updateByPid = toolNames.find((n) =>
                    ['update-resource-by-public-id', 'assets-update-resource-by-public-id'].includes(n),
                );

                let ok = false;
                let updatedAsset = undefined;

                if (updateByPid) {
                    const res = await client.callTool({
                        name: updateByPid,
                        arguments: { resourceType: 'image', request: { public_id, type: 'upload', tags: tagsCsv } },
                    });
                    ok = parseUpdateSuccess(res?.content);
                    updatedAsset = parseUploadResult(res?.content) || undefined;
                } else {
                    const assetId = await getAssetIdByPublicId(client, public_id);
                    if (assetId) {
                        const res = await client.callTool({
                            name: 'asset-update',
                            arguments: { assetId, resourceUpdateRequest: { tags: tagsCsv } },
                        });
                        ok = parseUpdateSuccess(res?.content);
                        updatedAsset = parseUploadResult(res?.content) || undefined;
                    }
                }

                assistantMsg = ok
                    ? {
                        id: crypto.randomUUID(),
                        role: 'assistant',
                        text: `Tagged ${public_id} with: ${tagsCsv}`,
                        assets: updatedAsset ? [updatedAsset] : undefined,
                    }
                    : { id: crypto.randomUUID(), role: 'assistant', text: `Failed to tag "${public_id}".` };

            } else if (renameMatch) {
                // Rename direct
                const from_public_id = normalizePublicId(renameMatch[1].trim());
                const to_public_id = normalizePublicId(renameMatch[2].trim());
                const res = await client.callTool({
                    name: 'asset-rename',
                    arguments: { resourceType: 'image', requestBody: { from_public_id, to_public_id } },
                });

                const renamedAsset = parseUploadResult(res?.content);
                assistantMsg = renamedAsset
                    ? {
                        id: crypto.randomUUID(),
                        role: 'assistant',
                        text: `Successfully renamed asset to "${to_public_id}".`,
                        assets: [renamedAsset],
                    }
                    : {
                        id: crypto.randomUUID(),
                        role: 'assistant',
                        text: `Could not rename asset. Please ensure the public ID "${from_public_id}" exists.`,
                    };

            } else if (deleteMatch) {
                // Delete direct
                const public_id = normalizePublicId(deleteMatch[1].trim());
                const toolNames = await listToolNames(client);
                const bulkTool = toolNames.find((n) =>
                    ['assets-delete-resources-by-public-id', 'delete-resources-by-public-id', 'assets-delete'].includes(n),
                );
                let res: CallToolResult | undefined;

                if (bulkTool) {
                    res = await client.callTool({
                        name: bulkTool,
                        arguments: { resourceType: 'image', request: { public_ids: [public_id], type: 'upload' } },
                    });
                } else {
                    const listRes = await client.callTool({ name: 'list-images', arguments: {} });
                    const assetId = extractAssetIdFromList(listRes?.content, public_id);
                    if (!assetId) {
                        return [
                            ...currentState,
                            userMessage,
                            { id: crypto.randomUUID(), role: 'assistant', text: `Could not find asset_id for "${public_id}". Check the ID.` },
                        ];
                    }
                    res = await client.callTool({
                        name: 'delete-asset',
                        arguments: { resourceType: 'image', request: { asset_id: assetId, invalidate: true } },
                    });
                }

                const ok = parseDeleteSuccess(res?.content, public_id);
                assistantMsg = ok
                    ? { id: crypto.randomUUID(), role: 'assistant', text: `Deleted ${public_id}.` }
                    : { id: crypto.randomUUID(), role: 'assistant', text: `Failed to delete "${public_id}". Please check the ID.` };

            } else if (tagMatch) {
                // Tag direct
                const public_id = normalizePublicId(tagMatch[1].trim());
                const tagsCsv = normalizeTagsCSV(tagMatch[2]);
                const toolNames = await listToolNames(client);
                const updateByPid = toolNames.find((n) =>
                    ['update-resource-by-public-id', 'assets-update-resource-by-public-id'].includes(n),
                );

                let ok = false;
                let updatedAsset = undefined;

                if (updateByPid) {
                    const res = await client.callTool({
                        name: updateByPid,
                        arguments: { resourceType: 'image', request: { public_id, type: 'upload', tags: tagsCsv } },
                    });
                    ok = parseUpdateSuccess(res?.content);
                    updatedAsset = parseUploadResult(res?.content) || undefined;
                } else {
                    const assetId = await getAssetIdByPublicId(client, public_id);
                    if (assetId) {
                        const res = await client.callTool({
                            name: 'asset-update',
                            arguments: { assetId, resourceUpdateRequest: { tags: tagsCsv } },
                        });
                        ok = parseUpdateSuccess(res?.content);
                        updatedAsset = parseUploadResult(res?.content) || undefined;
                    }
                }

                assistantMsg = ok
                    ? {
                        id: crypto.randomUUID(),
                        role: 'assistant',
                        text: `Tagged ${public_id} with: ${tagsCsv}`,
                        assets: updatedAsset ? [updatedAsset] : undefined,
                    }
                    : { id: crypto.randomUUID(), role: 'assistant', text: `Failed to tag "${public_id}".` };

            } else if (createFolderMatch) {
                // Create folder
                const folderPath = createFolderMatch[2].trim().replace(/^\/+|\/+$/g, '');
                const toolNames = await listToolNames(client);
                const createTool = toolNames.find((n) =>
                    ['create-folder', 'folders-create-folder'].includes(n),
                );

                if (!createTool) {
                    assistantMsg = {
                        id: crypto.randomUUID(),
                        role: 'assistant',
                        text: 'No create-folder tool is available.',
                    };
                } else {
                    let ok = false;

                    // Preferred shape
                    try {
                        const res = await client.callTool({
                            name: createTool,
                            arguments: { folder: folderPath },
                        });
                        ok = parseCreateFolderSuccess(res?.content);
                    } catch {
                        // Fallbacks
                        try {
                            const res2 = await client.callTool({
                                name: createTool,
                                arguments: { request: { folder: folderPath } },
                            });
                            ok = parseCreateFolderSuccess(res2?.content);
                        } catch {
                            try {
                                const res3 = await client.callTool({
                                    name: createTool,
                                    arguments: { requestBody: { folder: folderPath } },
                                });
                                ok = parseCreateFolderSuccess(res3?.content);
                            } catch {
                                ok = false;
                            }
                        }
                    }

                    assistantMsg = ok
                        ? { id: crypto.randomUUID(), role: 'assistant', text: `Created folder "${folderPath}".` }
                        : { id: crypto.randomUUID(), role: 'assistant', text: `Failed to create folder "${folderPath}".` };
                }

            } else if (moveLastMatch && lastAssetId) {
                // Move above
                const folder = moveLastMatch[1].trim();
                const from_public_id = normalizePublicId(lastAssetId);
                const to_public_id = buildMoveTarget(folder, from_public_id);

                const res = await client.callTool({
                    name: 'asset-rename',
                    arguments: { resourceType: 'image', requestBody: { from_public_id, to_public_id } },
                });

                const moved = parseUploadResult(res?.content);
                assistantMsg = moved
                    ? {
                        id: crypto.randomUUID(),
                        role: 'assistant',
                        text: `Moved to "${folder}".`,
                        assets: [moved],
                    }
                    : { id: crypto.randomUUID(), role: 'assistant', text: 'Failed to move asset.' };

            } else if (moveMatch) {
                // Move direct
                const from_public_id = normalizePublicId(moveMatch[1].trim());
                const folder = moveMatch[2].trim();
                const to_public_id = buildMoveTarget(folder, from_public_id);

                const res = await client.callTool({
                    name: 'asset-rename',
                    arguments: { resourceType: 'image', requestBody: { from_public_id, to_public_id } },
                });

                const moved = parseUploadResult(res?.content);
                assistantMsg = moved
                    ? {
                        id: crypto.randomUUID(),
                        role: 'assistant',
                        text: `Moved to "${folder}".`,
                        assets: [moved],
                    }
                    : { id: crypto.randomUUID(), role: 'assistant', text: 'Failed to move asset.' };

            } else {
                // Help
                const tools = await listToolNames(client);
                assistantMsg = {
                    id: crypto.randomUUID(),
                    role: 'assistant',
                    text: 'Local MCP ready. How can I help you with your Cloudinary assets?',
                    tools,
                    hint: 'Tip, try "list images" to see your recent uploads.',
                };
            }
        }

        return [...currentState, userMessage, assistantMsg!];
    } catch {
        const errorMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'assistant',
            text: 'Sorry, an error occurred. Please check the server logs.',
        };
        return [...currentState, userMessage, errorMsg];
    } finally {
        if (client && typeof client.close === 'function') {
            client.close();
        }
    }
}
