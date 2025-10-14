import type { NextConfig } from "next";

// Dynamic basePath based on deployment target
const isLocalhost = process.env.NEXT_PUBLIC_IS_LOCALHOST === 'true';

const nextConfig: NextConfig = {
  // Enable static export for CSR/SPA deployment
  output: "export",

  // Disable image optimization (not needed for static export)
  images: {
    unoptimized: true,
  },

  // Optional: Configure trailing slashes
  trailingSlash: true,

  // Dynamic basePath: '' for localhost, '/radchat' for hospital deployment
  basePath: isLocalhost ? '' : '/radchat',
};

export default nextConfig;
