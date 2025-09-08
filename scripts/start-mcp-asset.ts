// scripts/start-mcp-asset.ts
import 'dotenv/config';
// ✨ FIX: Removed the unused 'ChildProcess' type
import { spawn } from 'node:child_process';

// --- Configuration ---
const PORT = Number(process.env.MCP_PORT || 8787);
const HEALTH_CHECK_URL = `http://localhost:${PORT}/sse`;
const HEALTH_CHECK_TIMEOUT = 20000; // 20 seconds
const HEALTH_CHECK_INTERVAL = 1000; // 1 second

// --- Helper Functions ---

/** Masks the API key and secret in a Cloudinary URL for safe logging. */
function mask(url: string): string {
    return url.replace(/:\/\/[^:]+:([^@]+)@/, '://***:***@');
}

/** Validates and returns the Cloudinary URL from environment variables. */
function getCloudinaryUrl(): string {
    if (process.env.CLOUDINARY_URL) {
        return process.env.CLOUDINARY_URL;
    }
    if (
        process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET
    ) {
        return `cloudinary://${process.env.CLOUDINARY_API_KEY}:${process.env.CLOUDINARY_API_SECRET}@${process.env.CLOUDINARY_CLOUD_NAME}`;
    }
    throw new Error(
        '❌ Cloudinary credentials not found. Please set CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME, API_KEY, and API_SECRET in your .env file.'
    );
}

/**
 * Periodically checks if the gateway server is responsive.
 * @returns {Promise<boolean>} True if the server becomes healthy, false if it times out.
 */
async function checkHealth(): Promise<boolean> {
    const startTime = Date.now();
    while (Date.now() - startTime < HEALTH_CHECK_TIMEOUT) {
        try {
            const response = await fetch(HEALTH_CHECK_URL, { method: 'GET' });
            if (response.ok) {
                return true;
            }
            // ✨ FIX: Updated to an empty catch block as the error variable is not used.
        } catch {
            // Errors are expected while the server is starting up, so we ignore them.
        }
        await new Promise((resolve) => setTimeout(resolve, HEALTH_CHECK_INTERVAL));
    }
    return false; // Timeout reached
}

// --- Main Execution ---

async function main() {
    console.log('🔹 Starting Cloudinary MCP Gateway...');

    const cloudinaryUrl = getCloudinaryUrl();
    console.log('   Using CLOUDINARY_URL:', mask(cloudinaryUrl));

    const cmd = 'npx';
    const args = [
        '-y',
        'supergateway',
        '--port',
        String(PORT),
        '--ssePath',
        '/sse',
        '--messagePath',
        '/message',
        '--stdio',
        'npx -y --package @cloudinary/asset-management -- mcp start',
    ];

    console.log(`   Spawning process...`);

    const child = spawn(cmd, args, {
        stdio: 'inherit',
        env: { ...process.env, CLOUDINARY_URL: cloudinaryUrl },
    });

    child.on('error', (err) => {
        console.error(`❌ Failed to start gateway: ${err.message}`);
        process.exit(1);
    });

    child.on('exit', (code) => {
        console.log(`\nGateway process exited with code ${code}.`);
    });

    console.log(`\n🩺 Checking gateway health at ${HEALTH_CHECK_URL}...`);
    const isHealthy = await checkHealth();

    if (isHealthy) {
        console.log('✅ Gateway is healthy and running!');
    } else {
        console.error(
            `❌ Gateway failed to respond after ${HEALTH_CHECK_TIMEOUT / 1000} seconds.`
        );
        child.kill();
        process.exit(1);
    }
}

main().catch((error) => {
    console.error(error.message);
    process.exit(1);
});