import { NextResponse } from "next/server";
import { cloudinaryServers } from "@/lib/cloudinary-servers";

// Demo: always use Asset Management server
const SERVER_NAME = "asset-management";

type ProtectedResourceMetadata = {
    authorization_servers?: string[];
    authorization_server?: string; // fallback if server returns a single string
};

type AuthorizationServerMetadata = {
    authorization_endpoint?: string;
    token_endpoint?: string;
};

/** Tiny fetch helper with typing */
async function getJson<T>(url: string | URL): Promise<T> {
    const res = await fetch(url.toString(), { method: "GET" });
    if (!res.ok) {
        throw new Error(`Fetch failed ${res.status} for ${url}`);
    }
    return (await res.json()) as T;
}

function pickAuthServer(prm: ProtectedResourceMetadata): string | null {
    if (Array.isArray(prm.authorization_servers) && prm.authorization_servers.length > 0) {
        return prm.authorization_servers[0]!;
    }
    if (typeof prm.authorization_server === "string" && prm.authorization_server.length > 0) {
        return prm.authorization_server;
    }
    return null;
}

export async function GET() {
    const server = cloudinaryServers.find((s) => s.name === SERVER_NAME);
    if (!server) {
        return NextResponse.json({ error: "Server missing" }, { status: 500 });
    }

    const appOrigin = process.env.NEXT_PUBLIC_APP_ORIGIN;
    if (!appOrigin) {
        return NextResponse.json({ error: "Missing NEXT_PUBLIC_APP_ORIGIN" }, { status: 500 });
    }

    // 1) Protected Resource Metadata
    const prmUrl = new URL("/.well-known/oauth-protected-resource", server.url);
    let prm: ProtectedResourceMetadata;
    try {
        prm = await getJson<ProtectedResourceMetadata>(prmUrl);
    } catch {
        return NextResponse.json({ error: "PRM fetch failed" }, { status: 500 });
    }

    // 2) Choose an Authorization Server
    const asIssuer = pickAuthServer(prm);
    if (!asIssuer) {
        return NextResponse.json({ error: "No authorization server in PRM" }, { status: 500 });
    }

    // 3) Authorization Server Metadata (RFC 8414 / OIDC)
    const candidates = [
        new URL("/.well-known/oauth-authorization-server", asIssuer).toString(),
        new URL("/.well-known/openid-configuration", asIssuer).toString(),
    ];

    let asMeta: AuthorizationServerMetadata | null = null;
    for (const u of candidates) {
        try {
            const meta = await getJson<AuthorizationServerMetadata>(u);
            if (meta.authorization_endpoint && meta.token_endpoint) {
                asMeta = meta;
                break;
            }
        } catch {
            // skip to next candidate
        }
    }

    if (!asMeta?.authorization_endpoint || !asMeta?.token_endpoint) {
        return NextResponse.json({ error: "Missing authorization or token endpoint" }, { status: 500 });
    }

    // 4) Build PKCE request
    const clientId = "cloudinary-mcp-demo-public"; // demo public client
    const redirectUri = new URL("/api/cloudinary/oauth/callback", appOrigin).toString();
    const scope = "openid offline_access";

    const verifier = crypto.randomUUID().replace(/-/g, "");
    const encoder = new TextEncoder();
    const digest = await crypto.subtle.digest("SHA-256", encoder.encode(verifier));
    const challenge = Buffer.from(new Uint8Array(digest)).toString("base64url");
    const state = crypto.randomUUID();

    const headers = new Headers();
    const set = (k: string, v: string) =>
        headers.append(
            "Set-Cookie",
            `${k}=${encodeURIComponent(v)}; HttpOnly; Path=/; Secure; SameSite=Lax; Max-Age=600`
        );
    set("pkce_verifier", verifier);
    set("oauth_state", state);
    set("token_endpoint", asMeta.token_endpoint);

    const authUrl = new URL(asMeta.authorization_endpoint);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", scope);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("code_challenge", challenge);
    authUrl.searchParams.set("code_challenge_method", "S256");

    return NextResponse.redirect(authUrl.toString(), { headers });
}
