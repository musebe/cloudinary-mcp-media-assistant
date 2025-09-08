'use server';

import { ChatMessage, ToolContent } from '@/types';
import { connectCloudinary } from '@/lib/mcp-client';
import { toAssetsFromContent, parseUploadResult } from '@/lib/mcp-utils';

type CallToolResult = { content?: ToolContent[] };
type ListToolsResult = { tools?: { name: string }[] };

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

    let client;
    try {
        client = await connectCloudinary("asset-management");
        let assistantMsg: ChatMessage | null = null;

        if (file instanceof File) {
            const buffer = Buffer.from(await file.arrayBuffer());
            const base64 = buffer.toString("base64");
            const mime = file.type || "application/octet-stream";
            const dataUri = `data:${mime};base64,${base64}`;
            const res = (await client.callTool({
                name: "upload-asset",
                arguments: { uploadRequest: { file: dataUri, fileName: file.name, folder: "chat_uploads" } },
            })) as CallToolResult;

            const uploaded = parseUploadResult(res?.content);
            assistantMsg = {
                id: crypto.randomUUID(),
                role: 'assistant',
                text: uploaded ? "Image uploaded successfully." : "Upload complete.",
                assets: uploaded ? [uploaded] : undefined,
            };
        } else {
            const wantList = /^(list|show)\s+(images|pics|photos?)$/i.test(text) || /^images?$/i.test(text);
            const renameMatch = text.match(/^rename\s+(.+?)\s+to\s+(.+)$/i);
            const renameLastMatch = text.match(/^rename the above image to\s+(.+)$/i);

            if (wantList) {
                const res = (await client.callTool({ name: "list-images", arguments: {} })) as CallToolResult;
                const assets = toAssetsFromContent(res?.content || []);
                assistantMsg = {
                    id: crypto.randomUUID(),
                    role: 'assistant',
                    text: assets?.length ? "Here are your latest images:" : "No images found.",
                    assets: assets ?? undefined,
                };
            } else if (renameLastMatch && lastAssetId) {
                const from_public_id = lastAssetId;
                const to_public_id = renameLastMatch[1].trim();
                const res = await client.callTool({
                    name: "asset-rename",
                    arguments: { resourceType: 'image', requestBody: { from_public_id, to_public_id } },
                }) as CallToolResult;

                const renamedAsset = parseUploadResult(res?.content);
                if (renamedAsset) {
                    assistantMsg = {
                        id: crypto.randomUUID(),
                        role: 'assistant',
                        text: `Successfully renamed asset to "${to_public_id}".`,
                        assets: [renamedAsset]
                    };
                } else {
                    assistantMsg = {
                        id: crypto.randomUUID(),
                        role: 'assistant',
                        text: `Could not rename asset. The ID "${from_public_id}" may no longer be valid.`
                    };
                }
            } else if (renameMatch) {
                const from_public_id = renameMatch[1].trim();
                const to_public_id = renameMatch[2].trim();
                const res = await client.callTool({
                    name: "asset-rename",
                    arguments: { resourceType: 'image', requestBody: { from_public_id, to_public_id } },
                }) as CallToolResult;

                const renamedAsset = parseUploadResult(res?.content);
                if (renamedAsset) {
                    assistantMsg = {
                        id: crypto.randomUUID(),
                        role: 'assistant',
                        text: `Successfully renamed asset to "${to_public_id}".`,
                        assets: [renamedAsset]
                    };
                } else {
                    assistantMsg = {
                        id: crypto.randomUUID(),
                        role: 'assistant',
                        text: `Could not rename asset. Please ensure the public ID "${from_public_id}" exists.`
                    };
                }
            } else {
                const toolsResp = (await client.listTools?.()) as ListToolsResult | undefined;
                const tools = toolsResp?.tools?.map((t) => t.name) ?? [];
                assistantMsg = {
                    id: crypto.randomUUID(),
                    role: 'assistant',
                    text: "Local MCP ready. How can I help you with your Cloudinary assets?",
                    tools,
                    hint: 'Tip: try "list images" to see your recent uploads.',
                };
            }
        }

        return [...currentState, userMessage, assistantMsg!];

    } catch (err) {
        console.error(err);
        const errorMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'assistant',
            text: "Sorry, an error occurred. Please check the server logs.",
        };
        return [...currentState, userMessage, errorMsg];
    } finally {
        await client?.close?.();
    }
}