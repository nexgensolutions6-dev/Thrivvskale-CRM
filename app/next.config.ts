import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Import screen (lead CSV) and voice notes upload through server actions; the
  // default 1 MB body limit is too tight (limits in uploadLimit and validateVoiceNote).
  experimental: {
    serverActions: { bodySizeLimit: "6mb" },
  },
  // An authenticated app reads cookies on every request, so there is nothing
  // static to cache. Cache Components and partial prefetching stay off.
  turbopack: {
    // Pin the root to this app so a stray lockfile in a parent directory
    // (for example the user's home folder) is not mistaken for the workspace.
    root: fileURLToPath(new URL(".", import.meta.url)),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
