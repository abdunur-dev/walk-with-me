import type { NextConfig } from "next";

// Static export: `npm run build` writes plain HTML to web/out, which the FastAPI app serves at /site.
// One container stays the one-hour install. No Node server is needed in production.
const nextConfig: NextConfig = {
  turbopack: { root: __dirname },
  output: "export",
  basePath: "/site",
  images: { unoptimized: true },
};

export default nextConfig;
