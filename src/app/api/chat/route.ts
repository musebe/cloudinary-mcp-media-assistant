import { NextResponse } from "next/server";
import { connectCloudinary } from "@/lib/mcp-client";
import type { AssetItem } from "@/components/chat/asset-list";

type ToolInfo = { name: string };
type ListToolsResult = { tools?: ToolInfo[] };

type TextPart = { type: "text"; text: string };
type JSONPart = { type: "json"; json: unknown };
type ToolContent = TextPart | JSONPart | { type: string;[k: string]: unknown };
type CallToolResult = { content?: ToolContent[] };

function isObject(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null;
}
function isArray(v: unknown): v is unknown[] {
    return Array.isArray(v);
}
function isJSONPart(p: ToolContent): p is JSONPart {
    return isObject(p) && p.type === "json" && "json" in p;
}

/** Clean a URL, remove quotes or JSON fragments */
function cleanUrl(u?: string): string | undefined {
    if (!u || typeof u !== "string") return undefined;
    // keep only up to first space or quote
    const trimmed = u.split(/[\s"']/)[0] ?? u;
    try {
        return new URL(trimmed).toString();
    } catch {
        return undefined;
    }
}

/** Parse Cloudinary list JSON into AssetItem[] */
function toAssetsFromContent(content: ToolContent[]): AssetItem[] | null {
    // Prefer JSON part
    let data: unknown = content.find(isJSONPart)?.json;

    // Some servers may send JSON as string
    if (typeof data === "string") {
        try {
            data = JSON.parse(data);
        } catch {
            data = null;
        }
    }

    if (!isObject(data)) return null;

    const arr: unknown[] =
        (isArray(data.resources) && data.resources) ||
        (isArray(data.items) && data.items) ||
        [];

    const out: AssetItem[] = [];
    for (const r of arr.slice(0, 5)) {
        if (!isObject(r)) continue;

        const id =
            (typeof r.public_id === "string" && r.public_id) ||
            (typeof r.publicId === "string" && r.publicId) ||
            (typeof r.asset_id === "string" && r.asset_id) ||
            "(unknown)";

        const folder =
            (typeof r.folder === "string" && r.folder) ||
            (typeof r.folder_path === "string" && r.folder_path) ||
            undefined;

        const secure = cleanUrl(
            (r.secure_url as string) || (r.secureUrl as string)
        );
        const plain = cleanUrl(r.url as string);
        const url = secure || plain;

        const createdAt =
            (typeof r.created_at === "string" && r.created_at) ||
            (typeof r.createdAt === "string" && r.createdAt) ||
            undefined;

        const format = typeof r.format === "string" ? r.format : undefined;
        const width = typeof r.width === "number" ? r.width : undefined;
        const height = typeof r.height === "number" ? r.height : undefined;

        // Tiny thumb, safe if on Cloudinary
        const thumbUrl =
            url && url.includes("/image/upload/")
                ? url.replace("/image/upload/", "/image/upload/c_fill,w_160,h_160,q_auto,f_auto/")
                : url;

        out.push({ id, url, thumbUrl, folder, createdAt, format, width, height });
    }

    return out.length ? out : null;
}

export async function POST(req: Request) {
    const body = await req.json().catch(() => ({}));
    const text = typeof body?.text === "string" ? body.text : "";

    try {
        const client = await connectCloudinary("asset-management");

        const wantList =
            /^(list|show)\s+(images|pics|photos?)$/i.test(text) || /^images?$/i.test(text);

        if (wantList && client.callTool) {
            const res = (await client.callTool({
                name: "list-images",
                arguments: { max_results: 10 },
            })) as CallToolResult;

            const content = Array.isArray(res?.content) ? (res.content as ToolContent[]) : [];
            const assets = toAssetsFromContent(content);

            await client.close?.();

            if (assets && assets.length) {
                return NextResponse.json({
                    reply: "Here are your latest images:",
                    assets,
                });
            }

            return NextResponse.json({
                reply: "No images found or response could not be parsed.",
            });
        }

        // Default, send tools as an array for better UI
        const toolsResp = (await client.listTools?.()) as ListToolsResult | undefined;
        const tools = toolsResp?.tools?.map((t) => t.name) ?? [];
        await client.close?.();

        return NextResponse.json({
            reply: "Local MCP ready.",
            tools,
            hint: 'Tip, type "list images" to fetch your top 5.',
        });
    } catch (err) {
        console.error(err);
        return NextResponse.json(
            { reply: "Local MCP call failed. Check the server and your creds." },
            { status: 500 }
        );
    }
}
