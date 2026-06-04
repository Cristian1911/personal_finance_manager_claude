import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  cacheComponents: true,
  cacheLife: {
    zeta: {
      stale: 120,
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
      {
        // Module reframed "Personas" → "Deudas personales".
        source: "/personas",
        destination: "/deudas-personales",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
