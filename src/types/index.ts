// types/index.ts

// Represents a single Cloudinary asset.
export type AssetItem = {
    id: string;
    url?: string;
    thumbUrl?: string;
    folder?: string;
    createdAt?: string; // ISO string
    format?: string;
    width?: number;
    height?: number;
};

// Represents a single message in the chat UI.
export type ChatMessage = {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    actionUrl?: string;
    assets?: AssetItem[];
    tools?: string[];
    hint?: string;
};

// Defines the structure of the JSON response from the server action.
export type ApiReply = {
    reply?: string;
    actionUrl?: string;
    assets?: AssetItem[];
    tools?: string[];
    hint?: string;
    error?: string;
};

// Represents a plain text part of a tool's raw response.
export type TextPart = {
    type: "text";
    text: string;
};

// Represents a JSON object part of a tool's raw response.
export type JSONPart = {
    type: "json";
    json: unknown;
};

// Represents the overall content from a tool, which can be text, JSON, or another custom type.
export type ToolContent = TextPart | JSONPart | { type: string;[k: string]: unknown };