import { authenticateRequest } from "@/lib/server/supabase-admin";
import { prepareGameTracks } from "@/lib/server/track-preparation";

export const runtime = "nodejs";
export const maxDuration = 45;

function safeError(error: unknown) {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "object" &&
          error !== null &&
          "message" in error &&
          typeof error.message === "string"
        ? error.message
        : String(error);
  if (raw.includes("AUTH_REQUIRED")) return [401, "AUTH_REQUIRED"] as const;
  if (raw.includes("NOT_IN_ROOM")) return [403, "NOT_IN_ROOM"] as const;
  if (raw.includes("HOST_ONLY")) return [403, "HOST_ONLY"] as const;
  if (raw.includes("ROOM_NOT_FOUND")) return [404, "ROOM_NOT_FOUND"] as const;
  if (raw.includes("SERVER_BACKEND_NOT_CONFIGURED")) {
    return [503, "PREPARATION_NOT_CONFIGURED"] as const;
  }
  return [500, "PREPARATION_FAILED"] as const;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  try {
    const user = await authenticateRequest(request);
    const { code } = await context.params;
    const forceRetry = new URL(request.url).searchParams.get("retry") === "1";
    const result = await prepareGameTracks(code, user.id, forceRetry);
    const status =
      result.status === "failed"
        ? 503
        : result.status === "preparing"
          ? 202
          : 200;
    return Response.json(result, { status });
  } catch (error) {
    const [status, code] = safeError(error);
    return Response.json({ status: "failed", error_code: code }, { status });
  }
}
