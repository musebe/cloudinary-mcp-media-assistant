import { NextResponse } from "next/server";
import { cloudinaryServers } from "@/lib/cloudinary-servers";

function parseWwwAuthenticate(h: string | null) {
    if (!h) return {};
    // Example: Bearer resource_metadata="https://.../.well-known/oauth-protected-resource"
    const m = /resource_metadata="([^"]+)"/i.exec(h);
    return { resourceMetadata: m?.[1] };
}

export async function GET() {
    const server = cloudinaryServers.find(s => s.name === "asset-management");
    if (!server) return NextResponse.json({ error: "Server missing" }, { status: 500 });

    // 1) Probe to get 401 + WWW-Authenticate
    const res = await fetch(server.url, { method: "GET" });
    if (res.status !== 401) {
        return NextResponse.json({ error: `Expected 401, got ${res.status}` }, { status: 500 });
    }

    const hdr = res.headers.get("www-authenticate");
    const { resourceMetadata } = parseWwwAuthenticate(hdr);

    // 2) Fetch protected resource metadata
    // Spec says it points to a well-known doc with the AS metadata link.
    // We keep this generic and expect standard fields.
    if (!resourceMetadata) {
        return NextResponse.json({ error: "Missing resource metadata" }, { status: 500 });
    }

    const prm = await fetch(resourceMetadata).then(r => r.json());
    // Common fields per OAuth Protected Resource Metadata and AS Metadata
    const authorizationServer = prm.authorization_server || prm.authorization_server_metadata;
    const asMetaUrl =
        typeof authorizationServer === "string" ? authorizationServer :
            authorizationServer?.issuer_metadata || authorizationServer?.metadata ||
            authorizationServer?.issuer || null;

    if (!asMetaUrl) {
        return NextResponse.json({ error: "Missing authorization server metadata" }, { status: 500 });
    }

    const asMeta = await fetch(asMetaUrl).then(r => r.json());
    const authorizeEndpoint = asMeta.authorization_endpoint;
    const tokenEndpoint = asMeta.token_endpoint;

    if (!authorizeEndpoint || !tokenEndpoint) {
        return NextResponse.json({ error: "Missing endpoints" }, { status: 500 });
    }

    // 3) Build a PKCE auth request
    const clientId = "cloudinary-mcp-demo-public"; // public client for demo
    const redirectUri = new URL("/api/cloudinary/oauth/callback", process.env.NEXT_PUBLIC_APP_ORIGIN!).toString();
    const scope = "openid offline_access"; // server defines final scopes
    const verifier = crypto.randomUUID().replace(/-/g, "");
    const encoder = new TextEncoder();
    const digest = await crypto.subtle.digest("SHA-256", encoder.encode(verifier));
    const challenge = Buffer.from(new Uint8Array(digest)).toString("base64url");

    // Save verifier in a short-lived cookie
    const state = crypto.randomUUID();
    const cookieHeaders = new Headers();
    cookieHeaders.append("Set-Cookie", `pkce_verifier=${verifier}; HttpOnly; Path=/; Secure; SameSite=Lax; Max-Age=600`);
    cookieHeaders.append("Set-Cookie", `oauth_state=${state}; HttpOnly; Path=/; Secure; SameSite=Lax; Max-Age=600`);
    cookieHeaders.append("Set-Cookie", `token_endpoint=${encodeURIComponent(tokenEndpoint)}; HttpOnly; Path=/; Secure; SameSite=Lax; Max-Age=600`);

    const authUrl = new URL(authorizeEndpoint);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", scope);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("code_challenge", challenge);
    authUrl.searchParams.set("code_challenge_method", "S256");

    return NextResponse.redirect(authUrl.toString(), { headers: cookieHeaders });
}
