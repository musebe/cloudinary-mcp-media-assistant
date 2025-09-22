// src/lib/cloudinary-servers.ts

// Placeholder for Cloudinary remote MCP servers.
// Docs: https://cloudinary.com/documentation/cloudinary_llm_mcp

export const cloudinaryServers = [
    { name: 'asset-management', url: process.env.CLOUDINARY_MCP_URL ?? 'http://localhost:8787/sse' },
];

