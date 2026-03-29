import type { NextConfig } from "next";

const remoteApi = process.env.REMOTE_API_URL; // e.g. https://opc.ruilisi.com

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['qiniu', 'urllib', 'proxy-agent'],
  // When NEXT_PUBLIC_API_BASE is set, proxy all /api/* and /oauth/* requests to
  // the remote server. This lets you run the Next.js dev server locally while
  // using the production backend (auth cookies, DB, etc.).
  ...(remoteApi && {
    async rewrites() {
      return [
        {
          source: '/api/:path*',
          destination: `${remoteApi}/api/:path*`,
        },
        {
          source: '/oauth/:path*',
          destination: `${remoteApi}/oauth/:path*`,
        },
      ]
    },
  }),
};

export default nextConfig;
