/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/admin/:path*',
        destination: `${process.env.FASTAPI_URL || 'http://localhost:8000'}/api/v1/admin/:path*`,
      },
      {
        source: '/api/spring/:path*',
        destination: `${process.env.SPRING_BOOT_URL || 'http://localhost:8080'}/api/v1/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
