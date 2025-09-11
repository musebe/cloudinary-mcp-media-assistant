// src/lib/openai.ts
import OpenAI from 'openai';

const apiKey = process.env.OPENAI_API_KEY;

// Warn (don’t crash) if the key is missing so dev servers still boot
if (!apiKey) {
    console.warn(
        '[openai] Missing OPENAI_API_KEY — the AI router will not work until this is set.'
    );
}

// Reuse a single client instance across HMR in dev
const globalForOpenAI = globalThis as unknown as { __openai?: OpenAI };

export const openai =
    globalForOpenAI.__openai ??
    new OpenAI({
        apiKey,
        // If you use a proxy/enterprise gateway, uncomment:
        // baseURL: process.env.OPENAI_BASE_URL,
        // organization: process.env.OPENAI_ORG, // optional
        // project: process.env.OPENAI_PROJECT, // optional
    });

if (process.env.NODE_ENV !== 'production') {
    globalForOpenAI.__openai = openai;
}

export default openai;
