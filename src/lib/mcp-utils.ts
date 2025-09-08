import { AssetItem, ToolContent, JSONPart, TextPart } from "@/types";

function isObject(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null;
}
function isJSONPart(p: ToolContent): p is JSONPart {
    return isObject(p) && p.type === "json" && "json" in p;
}
function isTextPart(p: ToolContent): p is TextPart {
    return isObject(p) && p.type === "text" && typeof p.text === "string";
}
function cleanUrl(u?: string): string | undefined {
    if (!u || typeof u !== "string") return undefined;
    const trimmed = u.split(/[\s"']/)[0] ?? u;
    try {
        const parsedUrl = new URL(trimmed);
        parsedUrl.protocol = 'https';
        return parsedUrl.toString();
    } catch {
        return undefined;
    }
}


/** Extract assets from MCP content */
export function toAssetsFromContent(content: ToolContent[]): AssetItem[] | null {
    let data: unknown = content.find(isJSONPart)?.json;

    if (!data) {
        const t = content.find(isTextPart)?.text;
        if (t && t.includes("{")) {
            const first = t.indexOf("{");
            const last = t.lastIndexOf("}");
            const candidate = last > first ? t.slice(first, last + 1) : t;
            try {
                data = JSON.parse(candidate);
            } catch { /* ignore */ }
        }
    }

    if (!isObject(data)) return null;
    const obj = data as Record<string, unknown>;
    const items = (Array.isArray(obj.resources) && obj.resources) || (Array.isArray(obj.items) && obj.items) || [];

    const out: AssetItem[] = [];
    for (const r of items.slice(0, 5)) {
        if (!isObject(r)) continue;
        const ro = r as Record<string, unknown>;

        // ✨ FIX: Prioritize 'public_id' and ignore 'asset_id'.
        const id = (typeof ro.public_id === "string" && ro.public_id) || crypto.randomUUID();

        const folder = (typeof ro.folder === "string" && ro.folder) || undefined;
        const url = cleanUrl((ro.secure_url as string | undefined) || (ro.url as string | undefined));
        const createdAt = (typeof ro.created_at === "string" && ro.created_at) || undefined;
        const format = typeof ro.format === "string" ? ro.format : undefined;
        const width = typeof ro.width === "number" ? ro.width : undefined;
        const height = typeof ro.height === "number" ? ro.height : undefined;
        const thumbUrl = url && url.includes("/image/upload/") ? url.replace("/image/upload/", "/image/upload/c_fill,w_160,h_160,q_auto,f_auto/") : url;
        out.push({ id, url, thumbUrl, folder, createdAt, format, width, height });
    }
    return out.length ? out : null;
}

/** Extract uploaded asset info */
export function parseUploadResult(content?: ToolContent[]): AssetItem | null {
    if (!content || !Array.isArray(content)) return null;
    let data: unknown = content.find(isJSONPart)?.json;

    if (!data) {
        const t = content.find(isTextPart)?.text;
        if (t && t.includes("{")) {
            try {
                data = JSON.parse(t);
            } catch { return null; }
        }
    }

    if (!isObject(data)) return null;
    const ro = data as Record<string, unknown>;
    const url = cleanUrl((ro.secure_url as string) || (ro.url as string));
    if (!url) return null;

    return {
        // ✨ FIX: Prioritize 'public_id' and ignore 'asset_id' here as well.
        id: (typeof ro.public_id === "string" && ro.public_id) || crypto.randomUUID(),
        url,
        thumbUrl: url,
        folder: typeof ro.folder === "string" ? ro.folder : undefined,
        createdAt: typeof ro.created_at === "string" ? ro.created_at : undefined,
        format: typeof ro.format === "string" ? ro.format : undefined,
        width: typeof ro.width === "number" ? ro.width : undefined,
        height: typeof ro.height === "number" ? ro.height : undefined,
    };
}