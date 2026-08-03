import path from "node:path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // We're inside a pnpm monorepo — pin the file-tracing root to the repo root.
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
};

export default nextConfig;
