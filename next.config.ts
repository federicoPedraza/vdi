import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */

  // Configure API route timeouts for parser processing
  serverExternalPackages: ['ollama'],

  // Configure serverless function timeout (for platforms like Vercel)
  async headers() {
    return [
      {
        source: '/api/process-parser',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
