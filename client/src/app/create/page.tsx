import Link from "next/link";
import { SiteHeader } from "@/components/brand";
import { CreateRoomForm } from "@/components/room-entry";

export default async function CreatePage({
  searchParams,
}: {
  searchParams: Promise<{ nickname?: string }>;
}) {
  const { nickname = "" } = await searchParams;
  return (
    <main className="inner-page">
      <SiteHeader />
      <div className="entry-heading">
        <p className="eyebrow">
          <span /> Host a game
        </p>
        <h1>Build your listening room.</h1>
        <p>
          Pick the format, invite your people, and press play when everyone is
          ready.
        </p>
      </div>
      <CreateRoomForm initialNickname={nickname} />
      <Link className="back-link" href="/">
        ← Back home
      </Link>
    </main>
  );
}
