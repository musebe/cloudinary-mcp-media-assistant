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

    try {
        // ✨ FIX: Add a 1.5-second delay to simulate a real network request.
        // This will make the typing bubble visible during local development.
        await new Promise(resolve => setTimeout(resolve, 1500));

        const client = await connectCloudinary("asset-management");
        let assistantMsg: ChatMessage | null = null;

        // ... (The rest of your logic remains exactly the same)
        if (file instanceof File) {
            // ... file upload logic ...
            const buffer = Buffer.from(await file.arrayBuffer());
            const base64 = buffer.toString("base64");
            const mime = file.type || "application/octet-stream";
            const dataUri = `data:${mime};base64,${base64}`;

            const res = (await client.callTool({
                name: "upload-asset",
                arguments: {
                    uploadRequest: { file: dataUri, fileName: file.name, folder: "chat_uploads" },
                },
            })) as CallToolResult;

            await client.close?.();

            const uploaded = parseUploadResult(res?.content);
            assistantMsg = {
                id: crypto.randomUUID(),
                role: 'assistant',
                text: uploaded ? "Image uploaded successfully." : "Upload complete.",
                assets: uploaded ? [uploaded] : undefined,
            };
        } else {
            // ... text processing logic ...
            const wantList = /^(list|show)\s+(images|pics|photos?)$/i.test(text) || /^images?$/i.test(text);

            if (wantList) {
                const res = (await client.callTool({ name: "list-images", arguments: {} })) as CallToolResult;
                const assets = toAssetsFromContent(res?.content || []);
                await client.close?.();

                assistantMsg = {
                    id: crypto.randomUUID(),
                    role: 'assistant',
                    text: assets?.length ? "Here are your latest images:" : "No images found.",
                    assets: assets ?? undefined,
                };
            } else {
                const toolsResp = (await client.listTools?.()) as ListToolsResult | undefined;
                const tools = toolsResp?.tools?.map((t) => t.name) ?? [];
                await client.close?.();

                assistantMsg = {
                    id: crypto.randomUUID(),
                    role: 'assistant',
                    text: "Local MCP ready. How can I help you with your Cloudinary assets?",
                    tools,
                    hint: 'Tip: try "list images" to see your recent uploads.',
                };
            }
        }

        return [...currentState, userMessage, assistantMsg];

    } catch (err) {
        console.error(err);
        const errorMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'assistant',
            text: "Sorry, an error occurred. Please check the server logs.",
        };
        return [...currentState, userMessage, errorMsg];
    }
}