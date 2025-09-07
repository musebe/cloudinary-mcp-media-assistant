import { NextResponse } from "next/server";

export async function POST(req: Request) {
    const { text } = await req.json();

    // For now, echo the text
    return NextResponse.json({
        reply: `You said: ${text}`,
    });
}
