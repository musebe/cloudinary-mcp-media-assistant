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
            try { data = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1)); }
            catch { /* ignore */ }
        }
    }

    if (!isObject(data)) return null;
    const items = (Array.isArray(data.resources) && data.resources) || (Array.isArray(data.items) && data.items) || [];
    const out: AssetItem[] = [];

    for (const r of items.slice(0, 5)) {
        if (!isObject(r)) continue;
        const ro = r as Record<string, unknown>;

        // ✨ FIX: The 'list-images' command returns the full public_id. Use it directly.
        // This prevents the "folder/folder/name" duplication bug.
        const finalId = (typeof ro.publicId === 'string' && ro.publicId) ||
            (typeof ro.public_id === 'string' && ro.public_id) ||
            (typeof ro.asset_id === 'string' && ro.asset_id) || // Fallback for display key
            crypto.randomUUID();

        const folder = (typeof ro.folder === 'string' && ro.folder) || undefined;
        const url = cleanUrl((ro.secureUrl as string) || (ro.secure_url as string) || (ro.url as string));
        const createdAt = (typeof ro.createdAt === "string" && ro.createdAt) || (typeof ro.created_at === "string" && ro.created_at) || undefined;
        const format = typeof ro.format === "string" ? ro.format : undefined;
        const width = typeof ro.width === "number" ? ro.width : undefined;
        const height = typeof ro.height === "number" ? ro.height : undefined;
        const thumbUrl = url && url.includes("/image/upload/") ? url.replace("/image/upload/", "/image/upload/c_fill,w_160,h_160,q_auto,f_auto/") : url;

        out.push({ id: finalId, url, thumbUrl, folder: folder || undefined, createdAt, format, width, height });
    }
    return out.length ? out : null;
}

/** Extract uploaded asset info */
export function parseUploadResult(content?: ToolContent[]): AssetItem | null {
    // This function remains correct as the 'upload' tool returns folder and public_id separately.
    if (!content || !Array.isArray(content)) return null;
    let data: unknown = null;
    const textPart = content.find(isTextPart);
    if (textPart?.text) {
        try { data = JSON.parse(textPart.text); }
        catch { return null; }
    } else {
        const jsonPart = content.find(isJSONPart);
        if (jsonPart?.json) { data = jsonPart.json; }
    }

    if (!isObject(data)) return null;
    const ro = data as Record<string, unknown>;

    const basePublicId = (typeof ro.publicId === 'string' && ro.publicId) || (typeof ro.public_id === 'string' && ro.public_id) || null;
    const folder = (typeof ro.folder === 'string' && ro.folder) || null;
    const assetId = (typeof ro.assetId === 'string' && ro.assetId) || (typeof ro.asset_id === 'string' && ro.asset_id) || null;
    const fullPublicId = basePublicId && folder ? `${folder}/${basePublicId}` : basePublicId;
    const finalId = fullPublicId || assetId || crypto.randomUUID();

    const url = cleanUrl((ro.secureUrl as string) || (ro.secure_url as string) || (ro.url as string));
    const createdAt = (typeof ro.createdAt === "string" && ro.createdAt) || (typeof ro.created_at === "string" && ro.created_at) || undefined;

    if (!url) return null;

    return {
        id: finalId,
        url,
        thumbUrl: url,
        folder: folder || undefined,
        createdAt: createdAt,
        format: typeof ro.format === "string" ? ro.format : undefined,
        width: typeof ro.width === "number" ? ro.width : undefined,
        height: typeof ro.height === "number" ? ro.height : undefined,
    };
}