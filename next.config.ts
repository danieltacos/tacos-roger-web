import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Genera un sitio 100% estático en la carpeta "out" (se sube a Netlify tal cual)
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
