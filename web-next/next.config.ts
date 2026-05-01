import type { NextConfig } from 'next';

// When deploying to GitHub Pages under https://<user>.github.io/<repo>/
// the workflow sets NEXT_PUBLIC_BASE_PATH=/<repo>. Locally it's empty.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

const nextConfig: NextConfig = {
  output: 'export',
  basePath,
  assetPrefix: basePath || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
