import 'dotenv/config'; // <-- loads .env, .env.local, etc.
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function main() {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY is not set");
    }
    const res = await client.responses.create({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        input: "Say 'hello' if you can read my key.",
    });
    console.log(res.output_text ?? "No output_text");
}

main().catch((e) => {
    console.error("Smoke test failed:", e);
    process.exit(1);
});
