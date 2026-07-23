import {
  authenticateRequest,
  getSupabaseAdminClient,
} from "@/lib/server/supabase-admin";

export const runtime = "nodejs";

interface AudioAccess {
  storage_path: string | null;
  fallback_url: string | null;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ code: string; roundId: string }> },
) {
  try {
    const user = await authenticateRequest(request);
    const { code, roundId } = await context.params;
    const client = getSupabaseAdminClient();
    const { data, error } = await client.rpc("service_round_audio_access", {
      p_code: code,
      p_user_id: user.id,
      p_round_id: roundId,
    });
    if (error) throw error;
    const access = data as unknown as AudioAccess;
    if (access.fallback_url) {
      return Response.json({
        audio_url: access.fallback_url,
        expires_at: null,
      });
    }
    if (!access.storage_path) throw new Error("AUDIO_NOT_READY");
    const signed = await client.storage
      .from("track-audio")
      .createSignedUrl(access.storage_path, 600);
    if (signed.error) throw signed.error;
    return Response.json({
      audio_url: signed.data.signedUrl,
      expires_at: new Date(Date.now() + 600_000).toISOString(),
    });
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
