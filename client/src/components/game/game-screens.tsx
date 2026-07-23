"use client";

import { BoltIcon, CheckIcon, VolumeIcon } from "@/components/icons";
import { Button, Panel, Spinner, StatusMessage } from "@/components/ui";
import { useClock } from "@/hooks/use-clock";
import { useSynchronizedAudio } from "@/hooks/use-synchronized-audio";
import { formatScore } from "@/lib/game/scoring";
import type { AnswerChoice, RoomState } from "@/lib/game/types";
import { Leaderboard } from "./leaderboard";

interface GameScreensProps {
  state: RoomState;
  serverOffsetMs: number;
  busyAction: string | null;
  actionError: string;
  onAnswer: (choice: AnswerChoice) => Promise<boolean>;
  onAgain: () => Promise<boolean>;
  onAudioReady: (roundId: string) => Promise<boolean>;
  onRetryPreparation: () => Promise<boolean>;
  onLeave: () => Promise<void>;
}

function secondsBetween(endsAt: string | null, now: number, offset: number) {
  if (!endsAt) return 0;
  return Math.max(0, (new Date(endsAt).getTime() - (now + offset)) / 1000);
}

function AudioStatus({
  audioState,
  muted,
  onActivate,
  onMute,
  onRetry,
}: {
  audioState: string;
  muted: boolean;
  onActivate: () => Promise<void>;
  onMute: () => void;
  onRetry: () => void;
}) {
  return (
    <div className="audio-status" role="status" aria-live="polite">
      <span className={`audio-dot audio-${audioState}`} />
      <span>
        {audioState === "loading" && "Preloading audio"}
        {audioState === "ready" && "Audio ready"}
        {audioState === "playing" && "Synchronized playback"}
        {audioState === "blocked" && "Tap to start audio"}
        {audioState === "error" && "Audio could not load"}
        {audioState === "ended" && "Clip complete"}
        {audioState === "idle" && "Waiting for track"}
      </span>
      {audioState === "blocked" && (
        <Button variant="secondary" onClick={() => void onActivate()}>
          Play audio
        </Button>
      )}
      {audioState === "error" && (
        <Button variant="secondary" onClick={onRetry}>
          Retry audio
        </Button>
      )}
      <Button
        className="mute-button"
        variant="ghost"
        onClick={onMute}
        aria-label={muted ? "Unmute music" : "Mute music"}
      >
        <VolumeIcon aria-hidden="true" /> {muted ? "Muted" : "Sound on"}
      </Button>
    </div>
  );
}

export function GameScreens({
  state,
  serverOffsetMs,
  busyAction,
  actionError,
  onAnswer,
  onAgain,
  onAudioReady,
  onRetryPreparation,
  onLeave,
}: GameScreensProps) {
  const now = useClock();
  const remaining = secondsBetween(
    state.room.phase_ends_at,
    now,
    serverOffsetMs,
  );
  const round = state.round;
  const audio = useSynchronizedAudio({
    code: state.room.code,
    round,
    phase: state.room.phase,
    serverOffsetMs,
    volume: state.room.settings.music_volume,
    onAudioReady,
  });

  if (state.room.phase === "preparing" && round) {
    const failed = round.preparation_status === "failed";
    const serverReady = round.preparation_status === "ready";
    return (
      <section
        className="phase-screen preparing-screen"
        aria-labelledby="preparing-title"
      >
        <div className="round-kicker">
          Round {round.number} of {round.total}
        </div>
        <div className="preparation-orb" aria-hidden="true">
          {!failed && <Spinner label="" />}
          {failed && "!"}
        </div>
        <p className="eyebrow">Preparing the next track</p>
        <h1 id="preparing-title">
          {failed
            ? "The track could not be prepared."
            : serverReady
              ? "Downloading for every player."
              : "Finding and caching your song."}
        </h1>
        <p aria-live="polite">
          {failed
            ? "Nothing will start with broken audio. The host can safely retry."
            : serverReady
              ? `${round.audio_ready_count}/${round.audio_required_count} players have audio ready.`
              : "The countdown begins only after the audio is available."}
        </p>
        {serverReady && (
          <AudioStatus
            audioState={audio.audioState}
            muted={audio.muted}
            onActivate={audio.activate}
            onMute={audio.toggleMuted}
            onRetry={audio.retry}
          />
        )}
        {failed && state.me.is_host && (
          <Button
            disabled={busyAction === "retry"}
            onClick={() => void onRetryPreparation()}
          >
            {busyAction === "retry" ? (
              <Spinner label="Retrying track preparation" />
            ) : (
              "Retry preparation"
            )}
          </Button>
        )}
        {failed && !state.me.is_host && (
          <p className="waiting-host">Waiting for the host to retry.</p>
        )}
        {actionError && <StatusMessage>{actionError}</StatusMessage>}
      </section>
    );
  }

  if (state.room.phase === "countdown") {
    return (
      <section
        className="phase-screen countdown-screen"
        aria-labelledby="countdown-title"
      >
        <div className="round-kicker">
          Round {round?.number || state.room.current_round} of{" "}
          {state.room.settings.round_count}
        </div>
        <p className="eyebrow">Get ready</p>
        <h1 id="countdown-title">Listen closely.</h1>
        <output className="countdown-value" aria-live="assertive">
          {Math.max(1, Math.ceil(remaining))}
        </output>
        <p>The clip begins at the same server timestamp for everyone.</p>
        <AudioStatus
          audioState={audio.audioState}
          muted={audio.muted}
          onActivate={audio.activate}
          onMute={audio.toggleMuted}
          onRetry={audio.retry}
        />
      </section>
    );
  }

  if (state.room.phase === "playing" && round) {
    const selected = round.own_answer;
    const locked =
      Boolean(selected) && !state.room.settings.allow_answer_changes;
    const timerRatio = Math.max(
      0,
      Math.min(1, remaining / state.room.settings.round_duration_seconds),
    );
    return (
      <section
        className="phase-screen playing-screen"
        aria-labelledby="playing-title"
      >
        <div className="game-status-row">
          <span>
            Round {round.number}/{round.total}
          </span>
          <span>
            <BoltIcon aria-hidden="true" />{" "}
            {formatScore(
              state.leaderboard.find((player) => player.is_me)?.score || 0,
            )}{" "}
            pts
          </span>
        </div>
        <Panel className="now-playing-card">
          <div className="now-playing-heading">
            <div>
              <p className="eyebrow">Now playing</p>
              <h1 id="playing-title">Who made this?</h1>
            </div>
            <div
              className="round-timer"
              aria-label={`${remaining.toFixed(1)} seconds remaining`}
            >
              <strong>{remaining.toFixed(1)}</strong>
              <span>sec</span>
            </div>
          </div>
          <div className="timer-track" aria-hidden="true">
            <i style={{ width: `${timerRatio * 100}%` }} />
          </div>
          <div className="audio-visualizer" aria-hidden="true">
            {Array.from({ length: 24 }, (_, index) => (
              <i key={index} />
            ))}
          </div>
          <div
            className="audio-progress"
            aria-label={`${Math.round(audio.progress * 100)} percent of audio played`}
          >
            <i style={{ width: `${audio.progress * 100}%` }} />
          </div>
          <AudioStatus
            audioState={audio.audioState}
            muted={audio.muted}
            onActivate={audio.activate}
            onMute={audio.toggleMuted}
            onRetry={audio.retry}
          />
        </Panel>

        <div className="answer-grid" aria-label="Choose who made the track">
          <Button
            className={`answer-button answer-ai ${selected === "ai" ? "selected" : ""}`}
            disabled={locked || busyAction === "answer"}
            onClick={() => void onAnswer("ai")}
            aria-pressed={selected === "ai"}
          >
            <span className="answer-symbol">◈</span>
            <span>
              <small>Machine origin</small>
              <strong>AI MADE</strong>
            </span>
            {selected === "ai" && <CheckIcon aria-label="Selected" />}
          </Button>
          <Button
            className={`answer-button answer-real ${selected === "real" ? "selected" : ""}`}
            disabled={locked || busyAction === "answer"}
            onClick={() => void onAnswer("real")}
            aria-pressed={selected === "real"}
          >
            <span className="answer-symbol">♥</span>
            <span>
              <small>Human origin</small>
              <strong>REAL / HUMAN</strong>
            </span>
            {selected === "real" && <CheckIcon aria-label="Selected" />}
          </Button>
        </div>

        <div className="submission-status" aria-live="polite">
          {busyAction === "answer" ? (
            <Spinner label="Submitting answer" />
          ) : selected ? (
            <>
              <CheckIcon aria-hidden="true" /> Answer{" "}
              {locked ? "locked" : "selected — you can still change it"}
            </>
          ) : (
            "Choose before the timer reaches zero."
          )}
          <span>
            {round.submitted_count}/{state.players.length} submitted
          </span>
        </div>
        {actionError && <StatusMessage>{actionError}</StatusMessage>}
      </section>
    );
  }

  if (state.room.phase === "reveal" && round) {
    const correct =
      round.own_answer !== null && round.own_answer === round.correct_answer;
    const points = round.own_points || 0;
    return (
      <section
        className="phase-screen reveal-screen"
        aria-labelledby="reveal-title"
      >
        <div className="round-kicker">
          Round {round.number} revealed · {remaining.toFixed(1)}s
        </div>
        <div
          className={`reveal-orb reveal-${round.correct_answer}`}
          aria-hidden="true"
        >
          {round.correct_answer === "ai" ? "◈" : "♥"}
        </div>
        <p className="eyebrow">Correct answer</p>
        <h1 id="reveal-title">
          {round.correct_answer === "ai" ? "AI MADE" : "HUMAN MADE"}
        </h1>
        <p className="track-reveal">
          <strong>{round.title}</strong>
          {round.artist ? ` · ${round.artist}` : ""}
        </p>
        <div
          className={`points-result ${points < 0 ? "points-negative" : ""}`}
          role="status"
        >
          {round.own_answer === null
            ? "No answer · 0 points"
            : `${correct ? "Correct" : "Not this time"} · ${points > 0 ? "+" : ""}${formatScore(points)} points`}
        </div>
        <Panel className="reveal-note">
          <p>{round.reveal_description}</p>
          <small>{round.license_note}</small>
          {(round.source_url || round.license_url) && (
            <div className="source-links">
              {round.source_url && (
                <a href={round.source_url} target="_blank" rel="noreferrer">
                  Song source
                </a>
              )}
              {round.license_url && (
                <a href={round.license_url} target="_blank" rel="noreferrer">
                  License
                </a>
              )}
            </div>
          )}
        </Panel>
        <div className="reveal-board">
          <div className="section-row">
            <div>
              <p className="eyebrow">Live ranking</p>
              <h2>Leaderboard</h2>
            </div>
          </div>
          <Leaderboard players={state.leaderboard} compact />
        </div>
      </section>
    );
  }

  if (state.room.phase === "intermission") {
    return (
      <section
        className="phase-screen intermission-screen"
        aria-labelledby="intermission-title"
      >
        <p className="eyebrow">Score check</p>
        <h1 id="intermission-title">
          Next track in {Math.max(1, Math.ceil(remaining))}
        </h1>
        <Leaderboard players={state.leaderboard} />
        <p className="intermission-note">
          Stay sharp. Speed matters as much as accuracy.
        </p>
      </section>
    );
  }

  if (state.room.phase === "finished") {
    const winner = state.leaderboard[0];
    return (
      <section
        className="phase-screen final-screen"
        aria-labelledby="final-title"
      >
        <div className="final-burst" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
        <p className="eyebrow">Final results</p>
        <h1 id="final-title">
          {winner ? `${winner.nickname} takes the room.` : "Game complete."}
        </h1>
        <p>
          {winner
            ? `${formatScore(winner.score)} points and the sharpest ears tonight.`
            : "No final scores were recorded."}
        </p>
        <Leaderboard players={state.leaderboard} />
        {state.round_history.length > 0 && (
          <Panel className="final-song-list">
            <p className="eyebrow">Songs played</p>
            <h2>Round history</h2>
            <ol>
              {state.round_history.map((song) => (
                <li key={song.round_number}>
                  <span>
                    <strong>{song.title}</strong>
                    <small>
                      {song.artist || "Unknown artist"} ·{" "}
                      {song.answer_type === "ai" ? "AI made" : "Human made"}
                    </small>
                  </span>
                  {song.source_url && (
                    <a href={song.source_url} target="_blank" rel="noreferrer">
                      Source
                    </a>
                  )}
                </li>
              ))}
            </ol>
          </Panel>
        )}
        {actionError && <StatusMessage>{actionError}</StatusMessage>}
        <div className="final-actions">
          {state.me.is_host ? (
            <Button
              disabled={busyAction === "again"}
              onClick={() => void onAgain()}
            >
              {busyAction === "again" ? (
                <Spinner label="Resetting room" />
              ) : (
                "Play again with this room"
              )}
            </Button>
          ) : (
            <p className="waiting-host">
              Waiting for the host to start another game.
            </p>
          )}
          <Button
            variant="secondary"
            disabled={busyAction === "leave"}
            onClick={() => void onLeave()}
          >
            Leave room
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="phase-screen">
      <Spinner label="Synchronizing the next phase" />
    </section>
  );
}
