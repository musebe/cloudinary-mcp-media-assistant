// Demo only. Replace with a DB or secure KV in prod.

type TokenSet = { access_token: string; refresh_token?: string; expires_at?: number };

const store = new Map<string, TokenSet>();

export function saveTokens(userId: string, tokens: TokenSet) {
    store.set(userId, tokens);
}

export function getTokens(userId: string): TokenSet | undefined {
    return store.get(userId);
}
