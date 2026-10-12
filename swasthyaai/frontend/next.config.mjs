/**
 * The browser calls /api/... and /uploads/... on the Next.js server,
 * which forwards them to FastAPI. This avoids CORS problems in development.
 * Set BACKEND_URL in .env.local if FastAPI is not on 127.0.0.1:8000 (use 127.0.0.1, not localhost: Node may resolve localhost to IPv6 ::1, which uvicorn does not listen on).
 */
const BACKEND_URL = (process.env.BACKEND_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The AI analysis (model + Grad-CAM on CPU) can take longer than the
  // default 30-second proxy limit, so allow up to 3 minutes.
  experimental: {
    proxyTimeout: 180_000,
  },
  // FastAPI routes such as /api/patients/ end with a slash; keep it as-is.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      { source: '/api/:path*/', destination: `${BACKEND_URL}/api/:path*/` },
      { source: '/api/:path*', destination: `${BACKEND_URL}/api/:path*` },
      { source: '/uploads/:path*', destination: `${BACKEND_URL}/uploads/:path*` },
    ];
  },
};

export default nextConfig;
