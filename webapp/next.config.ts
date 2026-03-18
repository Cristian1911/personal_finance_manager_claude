import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  cacheComponents: true,
  cacheLife: {
    zeta: {
      stale: 300,
      revalidate: 300,
      expire: 3600,
    },
  },
  turbopack: {
    root: "..",
  },
  async redirects() {
    return [
      {
        source: "/deudas/simulador",
        destination: "/deudas/planificador",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
