// scripts/start-mcp-asset.ts
import "dotenv/config";
import { spawn } from "node:child_process";

const PORT = Number(process.env.MCP_PORT || 8787);

// Helper to hide secrets in logs
function mask(url: string) {
    return url.replace(/:\/\/[^:]+:([^@]+)@/, "://***@");
}

const cmd = "npx";
const args = [
    "-y",
    "supergateway",
    "--port",
    String(PORT),
    // expose SSE at /sse and /message
    "--ssePath",
    "/sse",
    "--messagePath",
    "/message",
    // run Cloudinary's stdio server
    "--stdio",
    `npx -y --package @cloudinary/asset-management -- mcp start`,
];

console.log("Starting stdio → SSE gateway on:", `http://localhost:${PORT}/sse`);

if (process.env.CLOUDINARY_URL) {
    console.log("Using CLOUDINARY_URL:", mask(process.env.CLOUDINARY_URL));
} else if (
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
) {
    const builtUrl = `cloudinary://${process.env.CLOUDINARY_API_KEY}:${process.env.CLOUDINARY_API_SECRET}@${process.env.CLOUDINARY_CLOUD_NAME}`;
    console.log("Using CLOUDINARY_URL:", mask(builtUrl));
}

const child = spawn(cmd, args, {
    stdio: "inherit",
    env: {
        ...process.env,
        CLOUDINARY_URL:
            process.env.CLOUDINARY_URL ||
            `cloudinary://${process.env.CLOUDINARY_API_KEY}:${process.env.CLOUDINARY_API_SECRET}@${process.env.CLOUDINARY_CLOUD_NAME}`,
    },
});

child.on("exit", (code) => {
    console.log("Gateway exited with code", code);
});
