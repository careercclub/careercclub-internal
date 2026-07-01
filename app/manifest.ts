import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "CCC Internal Operations",
    short_name: "CCC Internal",
    description: "CareerCclub internal ticketing and operations workspace.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#f0f4fc",
    theme_color: "#0a3d8f",
    orientation: "any",
    categories: ["business", "productivity"],
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512?maskable=1", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
