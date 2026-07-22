"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon, CrownIcon, VolumeIcon } from "@/components/icons";
import { Button, Panel, Spinner, StatusMessage } from "@/components/ui";
import { getStartGate } from "@/lib/game/room-rules";
import type { GameSettings, RoomState } from "@/lib/game/types";

interface LobbyProps {
  state: RoomState;
  busyAction: string | null;
  actionError: string;
  onReady: (ready: boolean) => Promise<boolean>;
  onSaveSettings: (settings: GameSettings) => Promise<boolean>;
  onStart: () => Promise<boolean>;
  onRemove: (playerId: string) => Promise<boolean>;
  onLeave: () => Promise<void>;
}

function AudioCheck() {
  const [enabled, setEnabled] = useState(false);
  const [failed, setFailed] = useState(false);

  async function enableAudio() {
    const audio = new Audio("/audio/track-001.wav");
    audio.volume = 0.015;
    try {
      await audio.play();
      window.setTimeout(() => {
        audio.pause();
        audio.currentTime = 0;
      }, 80);
      setEnabled(true);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }

  return (
    <div className="audio-check">
      <div>
        <strong>
          <VolumeIcon aria-hidden="true" /> Audio check
        </strong>
        <span>
          {enabled
            ? "This browser is ready for playback."
            : "Enable sound before the host starts."}
        </span>
      </div>
      <Button type="button" variant="secondary" onClick={enableAudio}>
        {enabled ? (
          <>
            <CheckIcon aria-hidden="true" /> Ready
          </>
        ) : (
          "Enable audio"
        )}
      </Button>
      {failed && (
        <small role="alert">
          Audio is blocked. Check this site&apos;s sound permission.
        </small>
      )}
    </div>
  );
}

export function LobbyScreen({
  state,
  busyAction,
  actionError,
  onReady,
  onSaveSettings,
  onStart,
  onRemove,
  onLeave,
}: LobbyProps) {
  const [settings, setSettings] = useState(state.room.settings);
  const [copyLabel, setCopyLabel] = useState("Copy link");
  const gate = getStartGate(state.players);
  const connected = state.players.filter(
    (player) => player.is_connected,
  ).length;
  const ready = state.players.filter((player) => player.is_ready).length;
  const shownSettings = state.me.is_host ? settings : state.room.settings;

  const shareUrl = `${typeof window === "undefined" ? "" : window.location.origin}/join?code=${state.room.code}`;

  async function copyRoomLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyLabel("Copied");
      window.setTimeout(() => setCopyLabel("Copy link"), 1800);
    } catch {
      setCopyLabel("Copy failed");
    }
  }

  async function shareRoom() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Song Guess: AI Or Real",
          text: `Join room ${state.room.code}`,
          url: shareUrl,
        });
        return;
      } catch {
        return;
      }
    }
    await copyRoomLink();
  }

  return (
    <div className="lobby-layout">
      <div className="lobby-main-column">
        <Panel className="room-code-panel">
          <div>
            <p className="eyebrow">Invite your players</p>
            <output
              className="room-code"
              aria-label={`Room code ${state.room.code}`}
            >
              {state.room.code}
            </output>
          </div>
          <div className="code-actions">
            <Button variant="secondary" onClick={copyRoomLink}>
              <CopyIcon aria-hidden="true" /> {copyLabel}
            </Button>
            <Button variant="ghost" onClick={shareRoom}>
              Share
            </Button>
          </div>
        </Panel>

        <Panel className="players-panel">
          <div className="section-row">
            <div>
              <p className="eyebrow">The room</p>
              <h2>Players</h2>
            </div>
            <span className="capacity">
              <i /> {connected}/8 online · {ready}/{state.players.length} ready
            </span>
          </div>
          {state.players.length === 0 ? (
            <p className="empty-state">
              The room is waiting for its first player.
            </p>
          ) : (
            <ul className="player-list">
              {state.players.map((player) => (
                <li
                  className={!player.is_connected ? "player-offline" : ""}
                  key={player.id}
                >
                  <span className="avatar" aria-hidden="true">
                    {player.nickname.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="player-identity">
                    <strong>{player.nickname}</strong>
                    <small>
                      {player.is_connected
                        ? player.id === state.me.id
                          ? "You"
                          : "Connected"
                        : "Disconnected · grace period"}
                    </small>
                  </span>
                  {player.is_host && (
                    <span className="host-badge">
                      <CrownIcon aria-hidden="true" /> Host
                    </span>
                  )}
                  <span
                    className={`ready-badge ${player.is_ready ? "is-ready" : ""}`}
                  >
                    {player.is_ready ? (
                      <>
                        <CheckIcon aria-hidden="true" /> Ready
                      </>
                    ) : (
                      "Not ready"
                    )}
                  </span>
                  {state.me.is_host && !player.is_host && (
                    <Button
                      className="remove-player"
                      variant="ghost"
                      aria-label={`Remove ${player.nickname}`}
                      disabled={busyAction === "remove"}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Remove ${player.nickname} from this room?`,
                          )
                        )
                          void onRemove(player.id);
                      }}
                    >
                      Remove
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <AudioCheck />
      </div>

      <aside className="lobby-side-column">
        <Panel className="settings-panel">
          <div className="section-row">
            <div>
              <p className="eyebrow">Host controls</p>
              <h2>Game setup</h2>
            </div>
            {!state.me.is_host && <span className="view-only">View only</span>}
          </div>
          <div className="settings-grid lobby-settings">
            <label className="field">
              <span className="field-label">Number of rounds</span>
              <select
                className="input"
                value={shownSettings.round_count}
                disabled={!state.me.is_host}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    round_count: Number(event.target.value),
                  })
                }
              >
                {[3, 4, 5, 6].map((value) => (
                  <option key={value} value={value}>
                    {value} rounds
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Answer time</span>
              <select
                className="input"
                value={shownSettings.round_duration_seconds}
                disabled={!state.me.is_host}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    round_duration_seconds: Number(event.target.value),
                  })
                }
              >
                {[10, 15, 20, 30, 45].map((value) => (
                  <option key={value} value={value}>
                    {value} seconds
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Reveal time</span>
              <select
                className="input"
                value={shownSettings.reveal_duration_seconds}
                disabled={!state.me.is_host}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    reveal_duration_seconds: Number(event.target.value),
                  })
                }
              >
                {[4, 5, 7, 10, 15].map((value) => (
                  <option key={value} value={value}>
                    {value} seconds
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Song pack</span>
              <select
                className="input"
                value={shownSettings.song_pack}
                disabled
              >
                <option value="demo">Original demo pack</option>
              </select>
            </label>
            <label className="switch-row">
              <span>
                <strong>Wrong-answer penalty</strong>
                <small>−500 points for a miss</small>
              </span>
              <input
                type="checkbox"
                checked={shownSettings.negative_points}
                disabled={!state.me.is_host}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    negative_points: event.target.checked,
                  })
                }
              />
            </label>
            <label className="switch-row">
              <span>
                <strong>Change answers</strong>
                <small>Before the timer ends</small>
              </span>
              <input
                type="checkbox"
                checked={shownSettings.allow_answer_changes}
                disabled={!state.me.is_host}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    allow_answer_changes: event.target.checked,
                  })
                }
              />
            </label>
            <label className="range-field">
              <span>
                <strong>Music volume</strong>
                <output>{Math.round(shownSettings.music_volume * 100)}%</output>
              </span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={shownSettings.music_volume}
                disabled={!state.me.is_host}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    music_volume: Number(event.target.value),
                  })
                }
              />
            </label>
          </div>
          {state.me.is_host && (
            <Button
              variant="secondary"
              disabled={busyAction === "settings"}
              onClick={() => void onSaveSettings(settings)}
            >
              {busyAction === "settings" ? (
                <Spinner label="Saving" />
              ) : (
                "Save settings"
              )}
            </Button>
          )}
        </Panel>

        {actionError && <StatusMessage>{actionError}</StatusMessage>}

        <div className="lobby-actions">
          <Button
            className={
              state.me.is_ready ? "ready-toggle active" : "ready-toggle"
            }
            variant={state.me.is_ready ? "secondary" : "primary"}
            disabled={busyAction === "ready"}
            onClick={() => void onReady(!state.me.is_ready)}
          >
            {busyAction === "ready" ? (
              <Spinner label="Updating" />
            ) : state.me.is_ready ? (
              "I’m not ready"
            ) : (
              "I’m ready"
            )}
          </Button>
          {state.me.is_host && (
            <>
              <Button
                disabled={!gate.canStart || busyAction === "start"}
                onClick={() => void onStart()}
              >
                {busyAction === "start" ? (
                  <Spinner label="Starting" />
                ) : (
                  "Start the game"
                )}
              </Button>
              <p
                className={`start-gate ${gate.canStart ? "gate-open" : ""}`}
                role="status"
              >
                {gate.reason}
              </p>
            </>
          )}
          <Button
            variant="ghost"
            disabled={busyAction === "leave"}
            onClick={() => void onLeave()}
          >
            Leave room
          </Button>
        </div>
      </aside>
    </div>
  );
}
