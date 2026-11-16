import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "The Makerie",
    short_name: "Makerie",
    description: "A personal crafting studio. A creative world by Muse.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a1230",
    theme_color: "#0a1230",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
