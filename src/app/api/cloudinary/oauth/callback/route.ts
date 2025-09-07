import { NextRequest, NextResponse } from "next/server";
import { saveTokens } from "@/lib/oauth";

export async function GET(req: NextRequest) {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    const cookieState = req.cookies.get("oauth_state")?.value;
    const verifier = req.cookies.get("pkce_verifier")?.value;
    const tokenEndpoint = req.cookies.get("token_endpoint")?.value
        ? decodeURIComponent(req.cookies.get("token_endpoint")!.value)
        : undefined;

    if (!code || !state || !verifier || !tokenEndpoint || state !== cookieState) {
        return NextResponse.redirect("/", { status: 302 });
    }

    const clientId = "cloudinary-mcp-demo-public";
    const redirectUri = new URL("/api/cloudinary/oauth/callback", process.env.NEXT_PUBLIC_APP_ORIGIN!).toString();

    // Token exchange
    const form = new URLSearchParams();
    form.set("grant_type", "authorization_code");
    form.set("client_id", clientId);
    form.set("code", code);
    form.set("redirect_uri", redirectUri);
    form.set("code_verifier", verifier);

    const tokenRes = await fetch(tokenEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
    });

    if (!tokenRes.ok) {
        return NextResponse.redirect("/", { status: 302 });
    }

    const tokenSet = await tokenRes.json();

    // Demo user id: single-user app
    saveTokens("demo-user", {
        access_token: tokenSet.access_token,
        refresh_token: tokenSet.refresh_token,
        expires_at: tokenSet.expires_in ? Math.floor(Date.now() / 1000) + tokenSet.expires_in : undefined,
    });

    // Clean cookies
    const headers = new Headers();
    const expire = "Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax";
    headers.append("Set-Cookie", `pkce_verifier=; ${expire}`);
    headers.append("Set-Cookie", `oauth_state=; ${expire}`);
    headers.append("Set-Cookie", `token_endpoint=; ${expire}`);

    // Back to chat
    return NextResponse.redirect("/", { status: 302, headers });
}
