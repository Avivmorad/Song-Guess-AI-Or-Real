import { Spinner } from "@/components/ui";

export default function RoomLoading() {
  return (
    <div className="full-state">
      <Spinner label="Opening the room" />
    </div>
  );
}
