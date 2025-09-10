'use server';

import { ChatMessage, MCPClient, CallToolResult } from '@/types';
import { connectCloudinary } from '@/lib/mcp-client';
import { toAssetsFromContent, parseUploadResult } from '@/lib/mcp-utils';
import {
    normalizePublicId,
    parseDeleteSuccess,
    extractAssetIdFromList,
    listToolNames,
    // tagging helpers
    normalizeTagsCSV,
    getAssetIdByPublicId,
    parseUpdateSuccess,
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
            const buffer = Buffer.from(await file.arrayBuffer());
            const base64 = buffer.toString('base64');
            const mime = file.type || 'application/octet-stream';
            const dataUri = `data:${mime};base64,${base64}`;

            const res = await client.callTool({
                name: 'upload-asset',
                arguments: { uploadRequest: { file: dataUri, fileName: file.name, folder: 'chat_uploads' } },
            });

            const uploaded = parseUploadResult(res?.content);
            assistantMsg = {
                id: crypto.randomUUID(),
                role: 'assistant',
                text: uploaded ? 'Image uploaded successfully.' : 'Upload complete.',
                assets: uploaded ? [uploaded] : undefined,
            };
        } else {
            const wantList =
                /^(list|show)\s+(images|pics|photos?)$/i.test(text) || /^images?$/i.test(text);
            const renameLastMatch = text.match(/^rename the above image to\s+(.+)$/i);
            const renameMatch = text.match(/^rename\s+(.+?)\s+to\s+(.+)$/i);
            const deleteLastMatch = text.match(/^delete the above image$/i);
            const deleteMatch = text.match(/^delete\s+(.+)$/i);
            const tagLastMatch = text.match(/^tag the above image with\s+(.+)$/i);
            const tagMatch = text.match(/^tag\s+(.+?)\s+with\s+(.+)$/i);

            if (wantList) {
                const res = await client.callTool({ name: 'list-images', arguments: {} });
                const assets = toAssetsFromContent(res?.content || []);
                assistantMsg = {
                    id: crypto.randomUUID(),
                    role: 'assistant',
                    text: assets?.length ? 'Here are your latest images:' : 'No images found.',
                    assets: assets ?? undefined,
                };

            } else if (renameLastMatch && lastAssetId) {
                const from_public_id = lastAssetId;
                const to_public_id = renameLastMatch[1].trim();
                const res = await client.callTool({
                    name: 'asset-rename',
                    arguments: { resourceType: 'image', requestBody: { from_public_id, to_public_id } },
                });

                const renamedAsset = parseUploadResult(res?.content);
                assistantMsg = renamedAsset
                    ? { id: crypto.randomUUID(), role: 'assistant', text: `Successfully renamed asset to "${to_public_id}".`, assets: [renamedAsset] }
                    : { id: crypto.randomUUID(), role: 'assistant', text: `Could not rename asset. The ID "${from_public_id}" may no longer be valid.` };

            } else if (deleteLastMatch && lastAssetId) {
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
                // tag the above image with X
                const public_id = normalizePublicId(lastAssetId);
                const tagsCsv = normalizeTagsCSV(tagLastMatch[1]);
                const toolNames = await listToolNames(client);
                const updateByPid = toolNames.find((n) =>
                    ['update-resource-by-public-id', 'assets-update-resource-by-public-id'].includes(n),
                );

                let ok = false;

                if (updateByPid) {
                    const res = await client.callTool({
                        name: updateByPid,
                        arguments: { resourceType: 'image', request: { public_id, type: 'upload', tags: tagsCsv } },
                    });
                    ok = parseUpdateSuccess(res?.content);
                } else {
                    const assetId = await getAssetIdByPublicId(client, public_id);
                    if (assetId) {
                        const res = await client.callTool({
                            name: 'asset-update',
                            arguments: { assetId, resourceUpdateRequest: { tags: tagsCsv } },
                        });
                        ok = parseUpdateSuccess(res?.content);
                    }
                }

                assistantMsg = ok
                    ? { id: crypto.randomUUID(), role: 'assistant', text: `Tagged ${public_id} with: ${tagsCsv}` }
                    : { id: crypto.randomUUID(), role: 'assistant', text: `Failed to tag "${public_id}".` };

            } else if (renameMatch) {
                const from_public_id = normalizePublicId(renameMatch[1].trim());
                const to_public_id = normalizePublicId(renameMatch[2].trim());
                const res = await client.callTool({
                    name: 'asset-rename',
                    arguments: { resourceType: 'image', requestBody: { from_public_id, to_public_id } },
                });

                const renamedAsset = parseUploadResult(res?.content);
                assistantMsg = renamedAsset
                    ? { id: crypto.randomUUID(), role: 'assistant', text: `Successfully renamed asset to "${to_public_id}".`, assets: [renamedAsset] }
                    : { id: crypto.randomUUID(), role: 'assistant', text: `Could not rename asset. Please ensure the public ID "${from_public_id}" exists.` };

            } else if (deleteMatch) {
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
                // tag <public_id> with X
                const public_id = normalizePublicId(tagMatch[1].trim());
                const tagsCsv = normalizeTagsCSV(tagMatch[2]);
                const toolNames = await listToolNames(client);
                const updateByPid = toolNames.find((n) =>
                    ['update-resource-by-public-id', 'assets-update-resource-by-public-id'].includes(n),
                );

                let ok = false;

                if (updateByPid) {
                    const res = await client.callTool({
                        name: updateByPid,
                        arguments: { resourceType: 'image', request: { public_id, type: 'upload', tags: tagsCsv } },
                    });
                    ok = parseUpdateSuccess(res?.content);
                } else {
                    const assetId = await getAssetIdByPublicId(client, public_id);
                    if (assetId) {
                        const res = await client.callTool({
                            name: 'asset-update',
                            arguments: { assetId, resourceUpdateRequest: { tags: tagsCsv } },
                        });
                        ok = parseUpdateSuccess(res?.content);
                    }
                }

                assistantMsg = ok
                    ? { id: crypto.randomUUID(), role: 'assistant', text: `Tagged ${public_id} with: ${tagsCsv}` }
                    : { id: crypto.randomUUID(), role: 'assistant', text: `Failed to tag "${public_id}".` };

            } else {
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
