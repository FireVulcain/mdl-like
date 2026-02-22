import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'image.tmdb.org',
        port: '',
        pathname: '/t/p/**',
      },
      {
        protocol: 'https',
        hostname: 'i.mydramalist.com',
      },
    ],
    // 384px for desktop, 640px for mobile (high DPI)
    deviceSizes: [384, 640, 750, 828, 1080, 1200, 1920],
    imageSizes: [],
  },
  // Enable experimental optimizations
  experimental: {
    optimizePackageImports: [
      // Icon library (1,583 modules if imported from barrel)
      'lucide-react',
      // Animation library
      'framer-motion',
      // Charting library
      'recharts',
      // Radix UI primitives (avoid loading all primitives)
      '@radix-ui/react-dialog',
      '@radix-ui/react-select',
      '@radix-ui/react-scroll-area',
      '@radix-ui/react-progress',
      '@radix-ui/react-separator',
      '@radix-ui/react-slot',
      '@radix-ui/react-visually-hidden',
      // Toast library
      'sonner',
    ],
  },
};


export default nextConfig;
