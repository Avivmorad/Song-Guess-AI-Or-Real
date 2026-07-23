import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Banger or Bot",
    short_name: "Banger or Bot",
    description: "A multiplayer human-or-AI music guessing game.",
    start_url: "/",
    display: "standalone",
    background_color: "#090a0d",
    theme_color: "#090a0d",
  };
}
