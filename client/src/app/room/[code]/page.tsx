import { RoomExperience } from "@/components/game/room-experience";
import { normalizeRoomCode } from "@/lib/game/types";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <RoomExperience code={normalizeRoomCode(code)} />;
}
