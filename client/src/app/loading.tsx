import { Spinner } from "@/components/ui";

export default function Loading() {
  return (
    <div className="full-state">
      <Spinner label="Loading Song Guess" />
    </div>
  );
}
