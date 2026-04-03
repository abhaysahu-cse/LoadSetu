/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // ── Mapbox GL requires this worker loader fix ────────────────
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Mapbox GL uses Web Workers; tell webpack where to find them
      config.resolve.alias = {
        ...config.resolve.alias,
        "mapbox-gl": "mapbox-gl",
      };
    }
    return config;
  },

  // ── Security headers ──────────────────────────────────────────
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)",
          },
          {
            // Allow Mapbox tiles & API in CSP
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://api.mapbox.com",
              "style-src 'self' 'unsafe-inline' https://api.mapbox.com https://fonts.googleapis.com",
              "img-src 'self' data: blob: https://*.mapbox.com https://*.tiles.mapbox.com",
              "font-src 'self' https://fonts.gstatic.com",
              "connect-src 'self' https://api.mapbox.com https://events.mapbox.com wss: ws:",
              "worker-src blob:",
            ].join("; "),
          },
        ],
      },
    ];
  },

  // ── Allowed image origins ─────────────────────────────────────
  images: {
    domains: ["api.mapbox.com"],
  },

  // ── Rewrite so frontend can call backends without exposing URLs ─
  async rewrites() {
    return [
      {
        source: "/api/spring/:path*",
        destination: `${process.env.NEXT_PUBLIC_SPRING_URL}/:path*`,
      },
      {
        source: "/api/ai/:path*",
        destination: `${process.env.NEXT_PUBLIC_FASTAPI_URL}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
