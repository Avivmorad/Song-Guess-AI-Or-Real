import {
  authenticateRequest,
  getSupabaseAdminClient,
} from "@/lib/server/supabase-admin";

export const runtime = "nodejs";

interface AudioAccess {
  tracks: Array<{
    round_id: string;
    storage_path: string | null;
    fallback_url: string | null;
  }>;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  try {
    const user = await authenticateRequest(request);
    const { code } = await context.params;
    const client = getSupabaseAdminClient();
    const { data, error } = await client.rpc("service_game_audio_access", {
      p_code: code,
      p_user_id: user.id,
    });
    if (error) throw error;

    const access = data as unknown as AudioAccess;
    const tracks = await Promise.all(
      access.tracks.map(async (track) => {
        if (track.fallback_url) {
          return { round_id: track.round_id, audio_url: track.fallback_url };
        }
        if (!track.storage_path) throw new Error("AUDIO_NOT_READY");
        const signed = await client.storage
          .from("track-audio")
          .createSignedUrl(track.storage_path, 600);
        if (signed.error) throw signed.error;
        return {
          round_id: track.round_id,
          audio_url: signed.data.signedUrl,
        };
      }),
    );
    return Response.json({ tracks });
  } catch (error) {
    const raw =
      error instanceof Error
        ? error.message
        : typeof error === "object" &&
            error !== null &&
            "message" in error &&
            typeof error.message === "string"
          ? error.message
          : String(error);
    const status = raw.includes("AUTH_REQUIRED")
      ? 401
      : raw.includes("NOT_IN_ROOM")
        ? 403
        : raw.includes("ROOM_NOT_FOUND")
          ? 404
          : raw.includes("AUDIO_NOT_READY")
            ? 409
            : 500;
    const code =
      status === 401
        ? "AUTH_REQUIRED"
        : status === 403
          ? "NOT_IN_ROOM"
          : status === 404
            ? "ROOM_NOT_FOUND"
            : status === 409
              ? "AUDIO_NOT_READY"
              : "AUDIO_ACCESS_FAILED";
    return Response.json({ error_code: code }, { status });
  }
}
