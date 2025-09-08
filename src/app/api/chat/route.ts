import { NextResponse } from "next/server";
import { connectCloudinary } from "@/lib/mcp-client";
import { AssetItem } from "@/types";


type ToolInfo = { name: string };
type ListToolsResult = { tools?: ToolInfo[] };

type TextPart = { type: "text"; text: string };
type JSONPart = { type: "json"; json: unknown };
type ToolContent = TextPart | JSONPart | { type: string; [k: string]: unknown };
type CallToolResult = { content?: ToolContent[] };

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

function cleanUrl(u?: string): string | undefined {
  if (!u || typeof u !== "string") return undefined;
  const trimmed = u.split(/[\s"']/)[0] ?? u;
  try {
    return new URL(trimmed).toString();
  } catch {
    return undefined;
  }
}

/** Extract assets from MCP content */
function toAssetsFromContent(content: ToolContent[]): AssetItem[] | null {
  let data: unknown = content.find(isJSONPart)?.json;

  if (!data) {
    const t = content.find(isTextPart)?.text;
    if (t && t.includes("{")) {
      const first = t.indexOf("{");
      const last = t.lastIndexOf("}");
      const candidate = last > first ? t.slice(first, last + 1) : t;
      try {
        data = JSON.parse(candidate);
      } catch {
        /* ignore */
      }
    }
  }

  if (!isObject(data)) return null;
  const obj = data as Record<string, unknown>;
  const items =
    (Array.isArray(obj.resources) && obj.resources) ||
    (Array.isArray(obj.items) && obj.items) ||
    [];

  const out: AssetItem[] = [];
  for (const r of items.slice(0, 5)) {
    if (!isObject(r)) continue;
    const ro = r as Record<string, unknown>;

    const id =
      (typeof ro.public_id === "string" && ro.public_id) ||
      (typeof ro.publicId === "string" && ro.publicId) ||
      (typeof ro.asset_id === "string" && ro.asset_id) ||
      "(unknown)";

    const folder =
      (typeof ro.folder === "string" && ro.folder) ||
      (typeof ro.folder_path === "string" && ro.folder_path) ||
      undefined;

    const secure = cleanUrl(
      (ro.secure_url as string | undefined) || (ro.secureUrl as string | undefined)
    );
    const plain = cleanUrl(ro.url as string | undefined);
    const url = secure || plain;

    const createdAt =
      (typeof ro.created_at === "string" && ro.created_at) ||
      (typeof ro.createdAt === "string" && ro.createdAt) ||
      undefined;

    const format = typeof ro.format === "string" ? ro.format : undefined;
    const width = typeof ro.width === "number" ? ro.width : undefined;
    const height = typeof ro.height === "number" ? ro.height : undefined;

    const thumbUrl =
      url && url.includes("/image/upload/")
        ? url.replace("/image/upload/", "/image/upload/c_fill,w_160,h_160,q_auto,f_auto/")
        : url;

    out.push({ id, url, thumbUrl, folder, createdAt, format, width, height });
  }

  return out.length ? out : null;
}

/** Extract uploaded asset info */
function parseUploadResult(content?: ToolContent[]): AssetItem | null {
  if (!content) return null;
  let data: unknown = content.find(isJSONPart)?.json;

  if (!data) {
    const t = content.find(isTextPart)?.text;
    if (t && t.includes("{")) {
      try {
        data = JSON.parse(t);
      } catch {
        return null;
      }
    }
  }

  if (!isObject(data)) return null;
  const ro = data as Record<string, unknown>;
  const url = cleanUrl((ro.secure_url as string) || (ro.url as string));
  if (!url) return null;

  return {
    id:
      (typeof ro.public_id === "string" && ro.public_id) ||
      (typeof ro.asset_id === "string" && ro.asset_id) ||
      "(unknown)",
    url,
    thumbUrl: url,
    folder: typeof ro.folder === "string" ? ro.folder : undefined,
    createdAt: typeof ro.created_at === "string" ? ro.created_at : undefined,
    format: typeof ro.format === "string" ? ro.format : undefined,
    width: typeof ro.width === "number" ? ro.width : undefined,
    height: typeof ro.height === "number" ? ro.height : undefined,
  };
}

/** Read text from request */
async function readTextFromRequest(req: Request): Promise<string> {
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("multipart/form-data")) {
    const form = await req.formData();
    const t = form.get("text");
    return typeof t === "string" ? t.trim() : "";
  }
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const t = body?.text;
  return typeof t === "string" ? t.trim() : "";
}

export async function POST(req: Request) {
  const ct = req.headers.get("content-type") || "";

  try {
    // Upload branch
    if (ct.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file");

      if (!(file instanceof File)) {
        return NextResponse.json({ reply: "No file provided." }, { status: 400 });
      }

      const client = await connectCloudinary("asset-management");
      const buffer = Buffer.from(await file.arrayBuffer());
      const base64 = buffer.toString("base64");
      const mime = file.type || "application/octet-stream";
      const dataUri = `data:${mime};base64,${base64}`;

      const res = (await client.callTool({
        name: "upload-asset",
        arguments: {
          uploadRequest: {
            file: dataUri,
            fileName: file.name,
            resourceType: "image",
            type: "upload",
            folder: "chat_uploads",
          },
        },
      })) as CallToolResult;

      await client.close?.();

      const uploaded = parseUploadResult(res?.content);
      if (uploaded) {
        return NextResponse.json({
          reply: "Image uploaded.",
          assets: [uploaded],
        });
      }

      return NextResponse.json({
        reply: `Uploaded: ${file.name}`,
      });
    }

    // Text branch
    const text = await readTextFromRequest(req);
    const client = await connectCloudinary("asset-management");

    const wantList =
      /^(list|show)\s+(images|pics|photos?)$/i.test(text) || /^images?$/i.test(text);

    if (wantList && client.callTool) {
      let res = (await client.callTool({
        name: "list-images",
        arguments: {},
      })) as CallToolResult;

      let assets = toAssetsFromContent(res?.content || []);
      if (!assets || assets.length === 0) {
        res = (await client.callTool({
          name: "list-images",
          arguments: { max_results: 10 },
        })) as CallToolResult;
        assets = toAssetsFromContent(res?.content || []);
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

    // Default: list tools (e.g. when you say "hi")
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
