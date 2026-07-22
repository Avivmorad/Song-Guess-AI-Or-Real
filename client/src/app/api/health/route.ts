import { NextResponse } from "next/server";
import { isBackendConfigured } from "@/lib/supabase/config";

export function GET() {
  return NextResponse.json(
    {
      status: "ok",
      application: "Song Guess: AI Or Real",
      multiplayer: isBackendConfigured()
        ? "configured"
        : "configuration-required",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
