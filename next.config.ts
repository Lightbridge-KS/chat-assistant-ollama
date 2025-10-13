import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable static export for CSR/SPA deployment
  output: "export",

  // Disable image optimization (not needed for static export)
  images: {
    unoptimized: true,
  },

  // Optional: Configure trailing slashes
  trailingSlash: true,
};

export default nextConfig;
