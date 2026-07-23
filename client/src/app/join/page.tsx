import Link from "next/link";
import { SiteHeader } from "@/components/brand";
import { JoinRoomForm } from "@/components/room-entry";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ nickname?: string; code?: string }>;
}) {
  const { nickname = "", code = "" } = await searchParams;
  return (
    <main className="inner-page join-page">
      <SiteHeader />
      <div className="join-layout">
        <JoinRoomForm initialNickname={nickname} initialCode={code} />
        <div className="join-art" aria-hidden="true">
          <span className="join-orbit orbit-one" />
          <span className="join-orbit orbit-two" />
          <div className="join-disc">
            <span>?</span>
          </div>
          <p>Listen closely.</p>
        </div>
      </div>
      <Link className="back-link" href="/">
        ← Back to Home
      </Link>
    </main>
  );
}
