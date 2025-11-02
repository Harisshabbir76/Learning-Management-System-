import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/auth/:path*',
        destination: 'http://localhost:5000/api/auth/:path*', // Your backend URL
      },
    ];
  },
};

export default nextConfig;
