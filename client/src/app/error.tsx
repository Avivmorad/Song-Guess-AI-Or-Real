"use client";

import { Button } from "@/components/ui";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="state-page">
      <section className="full-state error-state">
        <span className="state-code">ERR</span>
        <p className="eyebrow">Playback interrupted</p>
        <h1>Something went off beat.</h1>
        <p>The details were kept private. Try loading this screen again.</p>
        <Button onClick={reset}>Try again</Button>
      </section>
    </main>
  );
}
