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
          <span /> Host a Game
        </p>
        <h1>Set up your Banger or Bot room.</h1>
        <p>
          Choose the game settings, invite your friends, and start when everyone
          is ready.
        </p>
      </div>
      <CreateRoomForm initialNickname={nickname} />
      <Link className="back-link" href="/">
        ← Back to Home
      </Link>
    </main>
  );
}
