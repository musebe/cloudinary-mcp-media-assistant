import { NextResponse } from "next/server";
import { connectCloudinary } from "@/lib/mcp-client";
import type { AssetItem } from "@/components/chat/asset-list";

type ToolInfo = { name: string };
type ListToolsResult = { tools?: ToolInfo[] };

type TextPart = { type: "text"; text: string };
type JSONPart = { type: "json"; json: unknown };
type ToolContent = TextPart | JSONPart | { type: string;[k: string]: unknown };
type CallToolResult = { content?: ToolContent[] };

type CloudinaryResource = {
    public_id?: string;
    publicId?: string;
    asset_id?: string;
    folder?: string;
    folder_path?: string;
    secure_url?: string;
    secureUrl?: string;
    url?: string;
    created_at?: string;
    createdAt?: string;
    format?: string;
    width?: number;
    height?: number;
};

function isObject(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null;
}
function isJSONPart(p: ToolContent): p is JSONPart {
    return isObject(p) && (p as Record<string, unknown>).type === "json" && "json" in p;
}
function isTextPart(p: ToolContent): p is TextPart {
    return (
        isObject(p) &&
        (p as Record<string, unknown>).type === "text" &&
        typeof (p as Record<string, unknown>).text === "string"
    );
}

function getStr(o: Record<string, unknown>, k: keyof CloudinaryResource): string | undefined {
    const v = o[k as string];
    return typeof v === "string" ? v : undefined;
}
function getNum(o: Record<string, unknown>, k: keyof CloudinaryResource): number | undefined {
    const v = o[k as string];
    return typeof v === "number" ? v : undefined;
}
function getArr(o: Record<string, unknown>, k: string): unknown[] {
    const v = o[k];
    return Array.isArray(v) ? (v as unknown[]) : [];
}

function cleanUrl(u?: string): string | undefined {
    if (!u || typeof u !== "string") return undefined;
    const trimmed = u.split(/[\s"']/)[0] ?? u;
    try {
        return new URL(trimmed).toString();
    } catch {
        return undefined;
    }
}

/** Robustly extract Cloudinary asset array from MCP content */
function toAssetsFromContent(content: ToolContent[]): AssetItem[] | null {
    // 1) Prefer a JSON part
    let data: unknown = content.find(isJSONPart)?.json;

    // 2) If missing, try JSON hidden inside a text blob
    if (!data) {
        const t = content.find(isTextPart)?.text;
        if (t && t.includes("{")) {
            const first = t.indexOf("{");
            const last = t.lastIndexOf("}");
            const candidate = last > first ? t.slice(first, last + 1) : t;
            try {
                data = JSON.parse(candidate);
            } catch {
                // fall through
            }
        }
    }

    if (!isObject(data)) return null;

    const obj = data as Record<string, unknown>;
    const items = getArr(obj, "resources").length ? getArr(obj, "resources") : getArr(obj, "items");

    const out: AssetItem[] = [];
    for (const r of items.slice(0, 5)) {
        if (!isObject(r)) continue;
        const ro = r as Record<string, unknown>;

        const id =
            getStr(ro, "public_id") ||
            getStr(ro, "publicId") ||
            getStr(ro, "asset_id") ||
            "(unknown)";

        const folder = getStr(ro, "folder") || getStr(ro, "folder_path") || undefined;

        const secure = cleanUrl(getStr(ro, "secure_url") || getStr(ro, "secureUrl"));
        const plain = cleanUrl(getStr(ro, "url"));
        const url = secure || plain;

        const createdAt = getStr(ro, "created_at") || getStr(ro, "createdAt") || undefined;
        const format = getStr(ro, "format");
        const width = getNum(ro, "width");
        const height = getNum(ro, "height");

        const thumbUrl =
            url && url.includes("/image/upload/")
                ? url.replace("/image/upload/", "/image/upload/c_fill,w_160,h_160,q_auto,f_auto/")
                : url;

        out.push({ id, url, thumbUrl, folder, createdAt, format, width, height });
    }

    return out.length ? out : null;
}

export async function POST(req: Request) {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const text = typeof body?.text === "string" ? body.text : "";

    try {
        const client = await connectCloudinary("asset-management");

        const wantList =
            /^(list|show)\s+(images|pics|photos?)$/i.test(text) || /^images?$/i.test(text);

        if (wantList && client.callTool) {
            // Always send an object for arguments
            let res = (await client.callTool({
                name: "list-images",
                arguments: {},
            })) as CallToolResult;

            let content = Array.isArray(res?.content) ? (res.content as ToolContent[]) : [];
            let assets = toAssetsFromContent(content);

            if (!assets || assets.length === 0) {
                res = (await client.callTool({
                    name: "list-images",
                    arguments: { max_results: 10 },
                })) as CallToolResult;
                content = Array.isArray(res?.content) ? (res.content as ToolContent[]) : [];
                assets = toAssetsFromContent(content);
            }

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

        // Default, send tools as array for better UI
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
