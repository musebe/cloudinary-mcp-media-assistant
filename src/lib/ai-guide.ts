// src/lib/ai-guide.ts
import { openai } from '@/lib/openai';
import { GuideInput } from '@/types';


function hasOpenAI() {
    return !!process.env.OPENAI_API_KEY && process.env.ENABLE_AI_GUIDE !== 'false';
}

const DOCS_URL =
    process.env.CLOUDINARY_MCP_DOCS_URL ||
    // fallback; safe to keep as plain text
    'https://github.com/cloudinary-labs/cloudinary-mcp';

function buildSystemPrompt() {
    return [
        'You are a warm, concise product guide for a Cloudinary MCP chat.',
        'Tone: friendly, encouraging, not robotic. Keep answers short (1–3 sentences).',
        'Never invent features. If the user asks for something not implemented, say it is “in progress” and offer alternatives.',
        `Mention available actions naturally when helpful (list images, list folders, rename, move, delete, tag, create folder).`,
        `When user is lost or says "hi", briefly introduce what the chat can do and offer a nudge.`,
        `If it helps, point to docs with this exact link text: Cloudinary MCP server docs (${DOCS_URL}).`,
        'Never show code blocks or JSON. No bullet lists unless the default text already implies a list.',
    ].join(' ');
}

function buildUserPrompt(input: GuideInput) {
    const { userText, defaultText, intent, assetsCount, extraTips } = input;

    const hints: string[] = [];
    if (typeof assetsCount === 'number') {
        hints.push(`We just returned ${assetsCount} asset(s).`);
    }
    if (intent) {
        hints.push(`Detected intent: ${intent}.`);
    }
    if (extraTips?.length) {
        hints.push(`Tips: ${extraTips.join(' • ')}`);
    }

    return [
        `User said: "${userText}"`,
        `Assistant’s default reply (must keep meaning): "${defaultText}"`,
        hints.length ? `Context: ${hints.join(' | ')}` : '',
        'Rewrite the default reply to be more conversational and helpful, keeping it brief.',
    ]
        .filter(Boolean)
        .join('\n');
}

/**
 * Best-effort friendly wording. Falls back to `defaultText` on any error.
 * Also logs prompt/output for debugging.
 */
export async function generateFriendlyReply(input: GuideInput): Promise<string> {
    if (!hasOpenAI()) return input.defaultText;

    const system = buildSystemPrompt();
    const user = buildUserPrompt(input);

    try {
        // Debug logs (server only)
        console.log('[AI Guide] prompt:', { system, user });

        const resp = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            messages: [
                { role: 'system', content: system },
                { role: 'user', content: user },
            ],
            temperature: 0.5,
            max_tokens: 160,
        });

        const out =
            resp.choices?.[0]?.message?.content?.trim() || input.defaultText;

        console.log('[AI Guide] output:', out);
        return out;
    } catch (err) {
        console.warn('[AI Guide] failed:', err);
        return input.defaultText;
    }
}
