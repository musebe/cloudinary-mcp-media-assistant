import { NextResponse } from "next/server";
import { connectCloudinary } from "@/lib/mcp-client";

export async function POST(req: Request) {
    const { text } = await req.json();

    try {
        // Example: connect to one server (asset-management)
        const client = await connectCloudinary("asset-management");

        // For now, stub: just echo text. Later we’ll call client.tool(...)
        await client.close();

        return NextResponse.json({
            reply: `MCP ready. You said: ${text}`,
        });
    } catch (err) {
        console.error(err);
        return NextResponse.json(
            { reply: "Failed to connect to Cloudinary MCP." },
            { status: 500 }
        );
    }
}
