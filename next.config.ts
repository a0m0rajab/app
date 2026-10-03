import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Chat and Video are hidden from the app for now; their pages and APIs are kept.
  redirects() {
    return [
      { source: "/", destination: "/launch", permanent: false },
      { source: "/video", destination: "/launch", permanent: false },
    ];
  },
};

export default nextConfig;
