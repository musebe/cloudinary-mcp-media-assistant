
# AI-Powered Smart Media Uploader & Optimizer (Next.js + Cloudinary MCP)

Clean, fast chat UI for managing Cloudinary assets via **Model Context Protocol (MCP)** servers.
Upload images, list/search folders, rename/move/tag/delete assets — all from a simple chat.

> ✅ **MCP-first** (no OpenAI required)
> 🧪 Tested flows: upload, list images, list folders, rename, move, delete, tag, create folder
> 🧭 Conversational helper replies with examples and nudges back to supported actions

---

## 1) Features

* **Drag & drop uploads** → sent to a `chat_uploads` folder
* **“Natural” chat commands** mapped to Cloudinary tools
* **Folder discovery** (direct via tool if available, with client-side fallback)
* **Bulk-safe delete** (by public\_id with fallbacks)
* **Rename & Move** (rename under the hood)
* **Tagging** with CSV normalization
* **“Smart help”** message that lists what’s supported and shows examples

---

## 2) Architecture (high level)

```
Next.js (App Router)
  ├─ UI (React): ChatContainer, MessageBubble, AssetList, etc
  ├─ Server Action: sendMessageAction()
  │    └─ parses intent → calls lib/mcp-ops.ts helpers
  │         ├─ mcp-ops.ts  (upload/list/rename/move/delete/tag/create-folder)
  │         ├─ action-helpers.ts (parsers, id normalization, fallbacks)
  │         └─ mcp-utils.ts (asset extraction from tool content)
  └─ MCP Client: mcp-client.ts
       └─ connects to Cloudinary MCP SSE server (cloudinary-servers.ts)
```

---

## 3) Prerequisites

* **Node.js 18+** (Node 20 recommended)
* **pnpm** package manager
* A running **Cloudinary MCP SSE server** (e.g. `asset-management`) with your Cloudinary credentials configured **on the server side**.

> This app connects to the MCP server over SSE; it does **not** require your Cloudinary API key locally.

---

## 4) Quick Start

```bash
# 1) Install deps
pnpm i

# 2) Ensure your MCP server is up (example)
#    asset-management server should expose:  http://localhost:8787/sse

# 3) Point the client to your server:
#    Edit: src/lib/cloudinary-servers.ts
#    export const cloudinaryServers = [
#      { name: 'asset-management', url: 'http://localhost:8787/sse' },
#    ];

# 4) Run the dev app
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 5) Chat Commands You Can Use Today

* **Upload**
  Drag & drop a file or click the paperclip.

* **List images**
  `list images`

* **List images in a folder**
  `list images in marketing/banners`

* **List folders** (root or under a path)
  `list folders`
  `list folders in marketing`

* **Rename**
  `rename old/path/hero to marketing/hero-v2`
  `rename the above image to hero-v2` (uses last asset shown)

* **Move**
  `move old/path/hero to marketing`
  `move the above image to marketing`

* **Delete**
  `delete marketing/hero-v2`
  `delete the above image`

* **Tag**
  `tag marketing/hero-v2 with homepage, hero`
  `tag the above image with homepage`

* **Create folder**
  `create folder marketing/banners`

> If you ask for something unimplemented (e.g., **list videos**), the bot will say it’s not ready yet and guide you to what does work.

---

## 6) Configuration

* **MCP server targets**: `src/lib/cloudinary-servers.ts`
  Add or change entries like:

  ```ts
  export const cloudinaryServers = [
    { name: 'asset-management', url: 'http://localhost:8787/sse' },
  ];
  ```

* **Where uploads go**: `chat_uploads` (set in `mcp-ops.ts`).

* **Last asset context**: the client stores the most recent asset ID so you can say “rename/move/delete the above image”.

---

## 7) Key Files

* `src/app/(chat)/actions.ts` — parses chat text → calls ops → returns assistant reply
* `src/lib/mcp-ops.ts` — **all Cloudinary operations** (upload, list, folders, rename, move, delete, tag, create-folder)
* `src/lib/action-helpers.ts` — parsing helpers & fallbacks
* `src/lib/mcp-utils.ts` — extracts `AssetItem[]` from tool results
* `src/lib/mcp-client.ts` — connects to MCP SSE
* `src/components/chat/*` — UI

---

## 8) Troubleshooting

* **“Unknown server: asset-management”**
  → Edit `cloudinary-servers.ts` and add your MCP server with the correct `name` & `url`.

* **“Sorry, an error occurred. Please check the server logs.”**
  → Your MCP server may be down or the URL is wrong. Confirm the SSE endpoint is reachable.

* **No folders returned**
  → Some MCP servers don’t expose a “list folders” tool; we fallback by inferring from image paths, but you may need to upload/list images first.

---

## 9) Roadmap / Optional AI Mode

* **AI-guided commands** (OpenAI Responses + MCP tools)

  * If you want to experiment, add to `.env.local`:

    ```
    OPENAI_API_KEY=sk-...
    OPENAI_MODEL=gpt-4o-mini
    MCP_SSE_URL=http://localhost:8787/sse
    ```
  * Wire the `ai-router` back in (disabled by default in this branch).
* Asset **content analysis** & **auto-tagging** (via Analysis MCP server)
* **Transformations** helper (Env/Transforms MCP)

---

**License:** MIT