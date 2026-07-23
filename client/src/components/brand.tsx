import Link from "next/link";

export function WaveMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="brand" href="/" aria-label="Banger or Bot home">
      <span className="brand-mark" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      {!compact && (
        <span className="brand-name">
          Banger <b>or Bot</b>
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
        <nav className="guide-nav" aria-label="Game guides">
          <Link className="guide-link" href="/#how-to-play">
            How to Play
          </Link>
          <Link className="guide-link" href="/#how-to-host">
            How to Host
          </Link>
        </nav>
      )}
    </header>
  );
}
