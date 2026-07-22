import Link from "next/link";

export function WaveMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="brand" href="/" aria-label="Song Guess: AI Or Real home">
      <span className="brand-mark" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      {!compact && (
        <span className="brand-name">
          Song Guess <b>AI Or Real</b>
        </span>
      )}
    </Link>
  );
}

export function SiteHeader({ roomCode }: { roomCode?: string }) {
  return (
    <header className="site-header">
      <WaveMark />
      {roomCode ? (
        <span className="header-room">
          Room <strong>{roomCode}</strong>
        </span>
      ) : (
        <a className="text-link" href="/#how-to-play">
          How to play
        </a>
      )}
    </header>
  );
}
