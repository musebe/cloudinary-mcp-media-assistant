// src/app/(chat)/actions.ts
'use server';

import type { ChatMessage, MCPClient } from '@/types';
import { connectCloudinary } from '@/lib/mcp-client';
import {
    normalizePublicId,
    listToolNames,
    normalizeTagsCSV,
} from '@/lib/action-helpers';

import {
    uploadFileToFolder,
    listImages,
    listFolders,
    renameByPublicId,
    moveToFolder,
    deleteByPublicId,
    tagByPublicId,
    createFolder as createFolderOp,
} from '@/lib/mcp-ops';

export async function sendMessageAction(
    previousState: ChatMessage[] | null,
    formData: FormData,
): Promise<ChatMessage[]> {
    const currentState = previousState ?? [];
    const file = formData.get('file');
    const text = (formData.get('text') as string) || '';
    const lastAssetId = formData.get('lastAssetId') as string | null;

    const userMessage: ChatMessage = {
        id: formData.get('id') as string,
        role: 'user',
        text: text || `Uploading ${formData.get('fileName') as string}...`,
    };

    let client: MCPClient | undefined;
    try {
        client = (await connectCloudinary('asset-management')) as unknown as MCPClient;
        let assistantMsg: ChatMessage | null = null;

        /* ------------------------------- Upload ------------------------------- */
        if (file instanceof File) {
            const uploaded = await uploadFileToFolder(client, file, 'chat_uploads');
            assistantMsg = {
                id: crypto.randomUUID(),
                role: 'assistant',
                text: uploaded ? 'Image uploaded successfully.' : 'Upload complete.',
                assets: uploaded ? [uploaded] : undefined,
            };
            return [...currentState, userMessage, assistantMsg];
        }

        /* --------------------------- Text intents ---------------------------- */
        const wantList =
            /^(list|show)\s+(images|pics|photos?)$/i.test(text) || /^images?$/i.test(text);

        const listImagesInMatch = text.match(
            /^(list|show)\s+(images|assets|files|photos?)\s+(in|from|under|inside)\s+(.+)$/i,
        );

        const listFoldersOnly = /^(list|show)\s+folders$/i.test(text);
        const listFoldersInMatch = text.match(/^(list|show)\s+folders\s+(in|under|inside)\s+(.+)$/i);

        const renameLastMatch = text.match(/^rename the above image to\s+(.+)$/i);
        const renameMatch = text.match(/^rename\s+(.+?)\s+to\s+(.+)$/i);

        const deleteLastMatch = text.match(/^delete the above image$/i);
        const deleteMatch = text.match(/^delete\s+(.+)$/i);

        const tagLastMatch = text.match(/^tag the above image with\s+(.+)$/i);
        const tagMatch = text.match(/^tag\s+(.+?)\s+with\s+(.+)$/i);

        const createFolderMatch = text.match(/^(create|make)\s+folder\s+(.+)$/i);
        const moveLastMatch = text.match(/^move the above image to\s+(.+)$/i);
        const moveMatch = text.match(/^move\s+(.+?)\s+to\s+(.+)$/i);

        /* ------------------------------ Handlers ----------------------------- */

        if (listImagesInMatch) {
            const folder = listImagesInMatch[4].trim().replace(/^\/+|\/+$/g, '');
            const all = await listImages(client);
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
            const base =
                (listFoldersInMatch ? listFoldersInMatch[3] : '').trim().replace(/^\/+|\/+$/g, '') || undefined;
            const folders = await listFolders(client, base, 5);

            assistantMsg = folders && folders.length
                ? {
                    id: crypto.randomUUID(),
                    role: 'assistant',
                    text: base ? `Folders under "${base}":` : 'Folders:',
                    assets: folders,
                }
                : { id: crypto.randomUUID(), role: 'assistant', text: 'No folders found.' };

        } else if (wantList) {
            const assets = await listImages(client);
            assistantMsg = {
                id: crypto.randomUUID(),
                role: 'assistant',
                text: assets.length ? 'Here are your latest images:' : 'No images found.',
                assets: assets || undefined,
            };

        } else if (renameLastMatch && lastAssetId) {
            const from_public_id = lastAssetId;
            const to_public_id = renameLastMatch[1].trim();
            const renamed = await renameByPublicId(client, from_public_id, to_public_id);
            assistantMsg = renamed
                ? {
                    id: crypto.randomUUID(),
                    role: 'assistant',
                    text: `Successfully renamed asset to "${to_public_id}".`,
                    assets: [renamed],
                }
                : {
                    id: crypto.randomUUID(),
                    role: 'assistant',
                    text: `Could not rename asset. The ID "${from_public_id}" may no longer be valid.`,
                };

        } else if (deleteLastMatch && lastAssetId) {
            const public_id = normalizePublicId(lastAssetId);
            const ok = await deleteByPublicId(client, public_id);
            assistantMsg = ok
                ? { id: crypto.randomUUID(), role: 'assistant', text: `Deleted ${public_id}.` }
                : { id: crypto.randomUUID(), role: 'assistant', text: `Failed to delete "${public_id}". It may not exist.` };

        } else if (tagLastMatch && lastAssetId) {
            const public_id = normalizePublicId(lastAssetId);
            const tagsCsv = normalizeTagsCSV(tagLastMatch[1]);
            const { ok, asset } = await tagByPublicId(client, public_id, tagsCsv);

            assistantMsg = ok
                ? {
                    id: crypto.randomUUID(),
                    role: 'assistant',
                    text: `Tagged ${public_id} with: ${tagsCsv}`,
                    assets: asset ? [asset] : undefined,
                }
                : { id: crypto.randomUUID(), role: 'assistant', text: `Failed to tag "${public_id}".` };

        } else if (renameMatch) {
            const from_public_id = normalizePublicId(renameMatch[1].trim());
            const to_public_id = normalizePublicId(renameMatch[2].trim());
            const renamed = await renameByPublicId(client, from_public_id, to_public_id);
            assistantMsg = renamed
                ? {
                    id: crypto.randomUUID(),
                    role: 'assistant',
                    text: `Successfully renamed asset to "${to_public_id}".`,
                    assets: [renamed],
                }
                : {
                    id: crypto.randomUUID(),
                    role: 'assistant',
                    text: `Could not rename asset. Please ensure the public ID "${from_public_id}" exists.`,
                };

        } else if (deleteMatch) {
            const public_id = normalizePublicId(deleteMatch[1].trim());
            const ok = await deleteByPublicId(client, public_id);
            assistantMsg = ok
                ? { id: crypto.randomUUID(), role: 'assistant', text: `Deleted ${public_id}.` }
                : { id: crypto.randomUUID(), role: 'assistant', text: `Failed to delete "${public_id}". Please check the ID.` };

        } else if (tagMatch) {
            const public_id = normalizePublicId(tagMatch[1].trim());
            const tagsCsv = normalizeTagsCSV(tagMatch[2]);
            const { ok, asset } = await tagByPublicId(client, public_id, tagsCsv);

            assistantMsg = ok
                ? {
                    id: crypto.randomUUID(),
                    role: 'assistant',
                    text: `Tagged ${public_id} with: ${tagsCsv}`,
                    assets: asset ? [asset] : undefined,
                }
                : { id: crypto.randomUUID(), role: 'assistant', text: `Failed to tag "${public_id}".` };

        } else if (createFolderMatch) {
            const folderPath = createFolderMatch[2].trim().replace(/^\/+|\/+$/g, '');
            const ok = await createFolderOp(client, folderPath);
            assistantMsg = ok
                ? { id: crypto.randomUUID(), role: 'assistant', text: `Created folder "${folderPath}".` }
                : { id: crypto.randomUUID(), role: 'assistant', text: `Failed to create folder "${folderPath}".` };

        } else if (moveLastMatch && lastAssetId) {
            const folder = moveLastMatch[1].trim();
            const moved = await moveToFolder(client, normalizePublicId(lastAssetId), folder);
            assistantMsg = moved
                ? { id: crypto.randomUUID(), role: 'assistant', text: `Moved to "${folder}".`, assets: [moved] }
                : { id: crypto.randomUUID(), role: 'assistant', text: 'Failed to move asset.' };

        } else if (moveMatch) {
            const from_public_id = normalizePublicId(moveMatch[1].trim());
            const folder = moveMatch[2].trim();
            const moved = await moveToFolder(client, from_public_id, folder);
            assistantMsg = moved
                ? { id: crypto.randomUUID(), role: 'assistant', text: `Moved to "${folder}".`, assets: [moved] }
                : { id: crypto.randomUUID(), role: 'assistant', text: 'Failed to move asset.' };

        } else {
            // Help with tool list + hint (unchanged behavior)
            const tools = await listToolNames(client);
            assistantMsg = {
                id: crypto.randomUUID(),
                role: 'assistant',
                text: 'Local MCP ready. How can I help you with your Cloudinary assets?',
                tools,
                hint: 'Tip, try "list images" to see your recent uploads.',
            };
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
