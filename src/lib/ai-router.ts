// src/lib/ai-router.ts

import { openai } from './openai';
import { toAssetsFromContent } from '@/lib/mcp-utils';
import type { AssetItem, ToolContent } from '@/types';
import type OpenAI from 'openai';

type AIResult = { text: string; assets?: AssetItem[] };

// A precise alias for a single tool entry in the Responses API
type ResponsesTool =
    NonNullable<OpenAI.Responses.ResponseCreateParams['tools']>[number];

// ---- Small type guards (no `any`) ----
function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null;
}

function synthesizeToolContentBlocks(obj: Record<string, unknown>): ToolContent[] {
    return [{ type: 'json', json: obj }];
}

function tryParseJsonFromText(text?: string): Record<string, unknown> | undefined {
    if (!text || !text.includes('{')) return undefined;
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return undefined;
    try {
        const parsed = JSON.parse(text.slice(start, end + 1));
        return isRecord(parsed) ? parsed : undefined;
    } catch {
        return undefined;
    }
}

export async function askOpenAIWithMCP(userText: string): Promise<AIResult> {
    // 👇 Default to gpt-4o as requested
    const model = process.env.OPENAI_MODEL ?? 'gpt-4o';
    const sseUrl = process.env.MCP_SSE_URL ?? 'http://localhost:8787/sse';

    // MCP tool descriptor for the Responses API
    const mcpTool = {
        type: 'mcp',
        server: { type: 'sse', url: sseUrl },
        // Some SDK versions accept this label field; harmless if ignored.
        server_label: 'Cloudinary MCP SSE',
    } as ResponsesTool;

    const resp = await openai.responses.create({
        model,
        input: [
            {
                role: 'system',
                content:
                    'You are a Cloudinary asset assistant. Prefer calling MCP tools to list, tag, rename, move, delete, or browse folders. If a tool returns JSON with `resources` or `items`, also give a short natural-language summary.',
            },
            { role: 'user', content: userText },
        ],
        tools: [mcpTool],
        tool_choice: 'auto',
    });

    const text = (resp as { output_text?: string }).output_text ?? 'Done.';
    const assetsCollected: AssetItem[] = [];

    // The Responses API returns a heterogeneous `output` array.
    // We scan for JSON blobs with {resources|items} and also try to parse JSON from text parts.
    const output = (resp as { output?: unknown }).output;
    if (Array.isArray(output)) {
        for (const item of output) {
            if (!isRecord(item)) continue;

            // Top-level `json`
            const topJson = item.json;
            if (isRecord(topJson)) {
                const hasAssets = Array.isArray(topJson.resources) || Array.isArray(topJson.items);
                if (hasAssets) {
                    const blocks = synthesizeToolContentBlocks(topJson);
                    const from = toAssetsFromContent(blocks) ?? [];
                    assetsCollected.push(...from);
                }
            }

            // Top-level `text`
            const topText = typeof item.text === 'string' ? item.text : undefined;
            const parsedTopText = tryParseJsonFromText(topText);
            if (parsedTopText) {
                const hasAssets =
                    Array.isArray(parsedTopText.resources) || Array.isArray(parsedTopText.items);
                if (hasAssets) {
                    const blocks = synthesizeToolContentBlocks(parsedTopText);
                    const from = toAssetsFromContent(blocks) ?? [];
                    assetsCollected.push(...from);
                }
            }

            // Nested `content` array
            const contentArr = Array.isArray(item.content) ? item.content : [];
            for (const c of contentArr) {
                if (!isRecord(c)) continue;

                const cj = c.json;
                if (isRecord(cj)) {
                    const hasAssets = Array.isArray(cj.resources) || Array.isArray(cj.items);
                    if (hasAssets) {
                        const blocks = synthesizeToolContentBlocks(cj);
                        const from = toAssetsFromContent(blocks) ?? [];
                        assetsCollected.push(...from);
                    }
                }

                const ct = typeof c.text === 'string' ? c.text : undefined;
                const parsedCt = tryParseJsonFromText(ct);
                if (parsedCt) {
                    const hasAssets =
                        Array.isArray(parsedCt.resources) || Array.isArray(parsedCt.items);
                    if (hasAssets) {
                        const blocks = synthesizeToolContentBlocks(parsedCt);
                        const from = toAssetsFromContent(blocks) ?? [];
                        assetsCollected.push(...from);
                    }
                }
            }
        }
    }

    return { text, assets: assetsCollected.length ? assetsCollected : undefined };
}
