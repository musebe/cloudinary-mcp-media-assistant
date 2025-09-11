// src/lib/mcp-client.ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { cloudinaryServers } from "./cloudinary-servers";

export async function connectCloudinary(serverName: string) {
    const server = cloudinaryServers.find((s) => s.name === serverName);
    if (!server) throw new Error(`Unknown server: ${serverName}`);

    const client = new Client({ name: "cloudinary-mcp-client", version: "0.1.0" });
    const transport = new SSEClientTransport(new URL(server.url));
    await client.connect(transport);
    return client;
}
