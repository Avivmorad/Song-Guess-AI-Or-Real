import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Song Guess: AI Or Real",
    short_name: "Song Guess",
    description: "A real-time multiplayer AI-or-human music guessing game.",
    start_url: "/",
    display: "standalone",
    background_color: "#090a0d",
    theme_color: "#090a0d",
  };
}
