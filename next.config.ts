import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Strict Mode's double mount in dev leaves a second Remotion audio player running, which echoes the preview.
  reactStrictMode: false,
  // Chat and Video are hidden from the app for now; their pages and APIs are kept.
  redirects() {
    return [
      { source: "/", destination: "/launch", permanent: false },
      { source: "/video", destination: "/launch", permanent: false },
    ];
  },
};

export default nextConfig;
