import type { NextConfig } from "next";

// Ensure the Cloudinary cloud name is set in the environment variables.
if (!process.env.CLOUDINARY_CLOUD_NAME) {
  throw new Error('ERROR: CLOUDINARY_CLOUD_NAME environment variable is not set.');
}

const nextConfig: NextConfig = {
  // Configuration for Next.js Image Optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        port: '',
        // Dynamically constructs the pathname from your .env file
        pathname: `/${process.env.CLOUDINARY_CLOUD_NAME}/**`,
      },
    ],
  },
};

export default nextConfig;