import { CrownIcon } from "@/components/icons";
import { formatScore } from "@/lib/game/scoring";
import type { LeaderboardPlayer } from "@/lib/game/types";

export function Leaderboard({
  players,
  compact = false,
}: {
  players: LeaderboardPlayer[];
  compact?: boolean;
}) {
  if (players.length === 0) {
    return <p className="empty-state">No ranked players yet.</p>;
  }
  return (
    <ol
      className={`leaderboard ${compact ? "leaderboard-compact" : ""}`}
      aria-label="Leaderboard"
    >
      {players.map((player, index) => (
        <li className={player.is_me ? "leader-me" : ""} key={player.id}>
          <span className="leader-rank">
            {index === 0 ? (
              <CrownIcon aria-label="First place" />
            ) : (
              String(index + 1).padStart(2, "0")
            )}
          </span>
          <span className="leader-name">
            {player.nickname}
            {player.is_me && <small>You</small>}
          </span>
          <strong>{formatScore(player.score)}</strong>
        </li>
      ))}
    </ol>
  );
}
