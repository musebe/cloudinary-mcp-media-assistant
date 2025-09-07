import { NextResponse } from "next/server";
import { connectCloudinary } from "@/lib/mcp-client";

/** Types that match common MCP client shapes */
type ToolInfo = { name: string };
type ListToolsResult = { tools?: ToolInfo[] };

type TextPart = { type: "text"; text: string };
type JSONPart = { type: "json"; json: unknown };
type ToolContent = TextPart | JSONPart | { type: string;[k: string]: unknown };
type CallToolResult = { content?: ToolContent[] };

/** Narrowing helpers */
function isObject(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null;
}
function isArray(v: unknown): v is unknown[] {
    return Array.isArray(v);
}
function isTextPart(p: ToolContent): p is TextPart {
    return isObject(p) && p.type === "text" && typeof (p as Record<string, unknown>).text === "string";
}
function isJSONPart(p: ToolContent): p is JSONPart {
    return isObject(p) && p.type === "json" && "json" in p;
}

/** Extract a readable list out of a tool JSON payload if present */
function extractListFromContent(content: ToolContent[]): string | null {
    const jsonPart = content.find(isJSONPart);
    if (jsonPart) {
        const j = jsonPart.json;

        // Try common Cloudinary list shapes:
        // { resources: [{ public_id, secure_url, ... }], next_cursor? }
        // or { items: [...] }
        if (isObject(j)) {
            const resources = ((): unknown[] => {
                if (isArray(j.resources)) return j.resources;
                if (isArray(j.items)) return j.items;
                return [];
            })();

            if (resources.length) {
                const lines = resources.slice(0, 5).map((r, i) => {
                    if (!isObject(r)) return `• item_${i + 1}`;
                    const id =
                        (typeof r.public_id === "string" && r.public_id) ||
                        (typeof r.asset_id === "string" && r.asset_id) ||
                        (typeof (r as Record<string, unknown>).publicId === "string" &&
                            (r as Record<string, string>).publicId) ||
                        `item_${i + 1}`;

                    const url =
                        (typeof r.secure_url === "string" && r.secure_url) ||
                        (typeof r.url === "string" && r.url) ||
                        (typeof (r as Record<string, unknown>).secureUrl === "string" &&
                            (r as Record<string, string>).secureUrl) ||
                        "";

                    return url ? `• ${id} — ${url}` : `• ${id}`;
                });
                return lines.join("\n");
            }
        }
    }

    const textPart = content.find(isTextPart);
    if (textPart) return textPart.text;

    return null;
}

export async function POST(req: Request) {
    const body = await req.json().catch(() => ({}));
    const text = typeof body?.text === "string" ? body.text : "";

    try {
        const client = await connectCloudinary("asset-management");

        // Do we want a list now
        const wantList =
            /^(list|show)\s+(images|pics|photos?)$/i.test(text) ||
            /^images?$/i.test(text);

        if (wantList && client.callTool) {
            // Call list-images
            const res = (await client.callTool({
                name: "list-images",
                arguments: { max_results: 5 },
            })) as CallToolResult;

            const content = isArray(res?.content)
                ? (res.content as ToolContent[])
                : [];

            const summary = extractListFromContent(content);
            await client.close?.();

            if (summary) {
                return NextResponse.json({
                    reply: `Here are your latest images:\n${summary}`,
                });
            }

            return NextResponse.json({
                reply: "I could not parse the list. Try again later.",
            });
        }

        // Otherwise, list tools so we know what is available
        const toolsResp = (await client.listTools?.()) as ListToolsResult | undefined;
        const toolNames = toolsResp?.tools?.map((t) => t.name) ?? [];
        await client.close?.();

        const list = toolNames.length ? toolNames.join(", ") : "none";
        return NextResponse.json({
            reply: `Local MCP ready. Tools: ${list}.\nTip, type "list images" to fetch your top 5.`,
        });
    } catch (err) {
        console.error(err);
        return NextResponse.json(
            { reply: "Local MCP call failed. Check the server and your creds." },
            { status: 500 }
        );
    }
}
