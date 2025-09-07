import { NextResponse } from "next/server";
import { connectCloudinary } from "@/lib/mcp-client";
import { getTokens } from "@/lib/oauth";

function hasCode(e: unknown): e is { code: number } {
    return typeof e === "object" && e !== null && "code" in e;
}

export async function POST(req: Request) {
    const { text } = await req.json();

    try {
        const tokens = getTokens("demo-user");
        if (!tokens?.access_token) {
            // If not authenticated, tell user to connect
            return NextResponse.json({
                reply: "Cloudinary needs OAuth. Go to /api/cloudinary/oauth/start to connect.",
            });
        }

        const client = await connectCloudinary("asset-management");

        // TODO: call real MCP tool here
        await client.close();

        return NextResponse.json({ reply: `Authorized. You said: ${text}` });
    } catch (err: unknown) {
        const code = hasCode(err) ? err.code : undefined;

        if (code === 401) {
            return NextResponse.json({
                reply: "Token invalid or expired. Reconnect here: /api/cloudinary/oauth/start",
            });
        }

        console.error(err);
        return NextResponse.json(
            { reply: "Failed to reach Cloudinary MCP." },
            { status: 500 }
        );
    }
}
