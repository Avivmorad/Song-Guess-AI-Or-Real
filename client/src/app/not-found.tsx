import Link from "next/link";
import { SiteHeader } from "@/components/brand";

export default function NotFound() {
  return (
    <main className="state-page">
      <SiteHeader />
      <section className="full-state error-state">
        <span className="state-code">404</span>
        <p className="eyebrow">Off the playlist</p>
        <h1>That page missed the beat.</h1>
        <p>The link may be old, or the room may have expired.</p>
        <Link className="button button-primary" href="/">
          Return home
        </Link>
      </section>
    </main>
  );
}
