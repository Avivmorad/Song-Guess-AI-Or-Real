"use client";

import { useState } from "react";
import {
  CheckIcon,
  CopyIcon,
  CrownIcon,
  ShareIcon,
  VolumeIcon,
} from "@/components/icons";
import { Button, Panel, Spinner, StatusMessage } from "@/components/ui";
import { playAudioTest, unlockGameAudio } from "@/lib/audio/game-audio-cache";
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
  const [copyLabel, setCopyLabel] = useState("Copy Code");
  const [saveStatus, setSaveStatus] = useState("");
  const [audioTestStatus, setAudioTestStatus] = useState<
    "idle" | "playing" | "ready" | "error"
  >("idle");
  const gate = getStartGate(state.players);
  const connected = state.players.filter(
    (player) => player.is_connected,
  ).length;
  const ready = state.players.filter((player) => player.is_ready).length;
  const shownSettings = state.me.is_host ? settings : state.room.settings;
  const demoTracksEnabled = process.env.NODE_ENV !== "production";
  const hasUnsavedSettings =
    JSON.stringify(settings) !== JSON.stringify(state.room.settings);
  const settingsSummary = `${shownSettings.round_count} rounds · ${shownSettings.round_duration_seconds} sec · ${shownSettings.reveal_duration_seconds} sec reveal · Penalty ${shownSettings.negative_points ? "on" : "off"}`;

  const shareUrl = `${typeof window === "undefined" ? "" : window.location.origin}/join?code=${state.room.code}`;

  async function copyRoomCode() {
    try {
      await navigator.clipboard.writeText(state.room.code);
      setCopyLabel("Room code copied ✓");
      window.setTimeout(() => setCopyLabel("Copy Code"), 1800);
    } catch {
      setCopyLabel("Copy failed");
    }
  }

  async function shareRoom() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Banger or Bot",
          text: `Join my Banger or Bot room: ${state.room.code}`,
          url: shareUrl,
        });
        return;
      } catch {
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyLabel("Invite link copied ✓");
      window.setTimeout(() => setCopyLabel("Copy Code"), 1800);
    } catch {
      setCopyLabel("Share failed");
    }
  }

  async function testAudio() {
    setAudioTestStatus("playing");
    try {
      await playAudioTest();
      setAudioTestStatus("ready");
    } catch {
      setAudioTestStatus("error");
    }
  }

  async function saveSettings() {
    setSaveStatus("");
    if (await onSaveSettings(settings)) {
      setSaveStatus("Settings saved ✓");
      window.setTimeout(() => setSaveStatus(""), 2200);
    }
  }

  function toggleReady() {
    if (!state.me.is_ready) void unlockGameAudio();
    void onReady(!state.me.is_ready);
  }

  function startGame() {
    void unlockGameAudio();
    void onStart();
  }

  return (
    <div className="lobby-layout">
      <div className="lobby-main-column">
        <Panel className="room-code-panel">
          <div>
            <h2>Invite players</h2>
            <p className="room-code-label">Room Code</p>
            <output
              className="room-code"
              aria-label={`Room code ${state.room.code}`}
            >
              {state.room.code}
            </output>
          </div>
          <div className="code-actions">
            <Button variant="secondary" onClick={copyRoomCode}>
              <CopyIcon aria-hidden="true" /> {copyLabel}
            </Button>
            <Button variant="ghost" onClick={shareRoom}>
              <ShareIcon aria-hidden="true" /> Share Invite
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
              <i /> {connected} {connected === 1 ? "player" : "players"} online
              · {ready} ready
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
                          ? player.is_host
                            ? "Host · You"
                            : "You"
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
                      "Not Ready"
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

        <Panel className="audio-test-panel">
          <div>
            <p className="eyebrow">Audio Check</p>
            <h2>Test your audio</h2>
            <p>Play a short sound to make sure you can hear the music.</p>
          </div>
          <Button
            variant="secondary"
            disabled={audioTestStatus === "playing"}
            onClick={() => void testAudio()}
          >
            {audioTestStatus === "playing" ? (
              <Spinner label="Playing test sound" />
            ) : (
              <>
                <VolumeIcon aria-hidden="true" /> Play Test Sound
              </>
            )}
          </Button>
          <p
            className={`audio-test-result audio-test-${audioTestStatus}`}
            role="status"
          >
            {audioTestStatus === "ready" && "Audio Ready ✓"}
            {audioTestStatus === "error" &&
              "Audio could not play. Check your device volume and try again."}
          </p>
        </Panel>
      </div>

      <aside className="lobby-side-column">
        <Panel className="settings-panel">
          <details className="settings-disclosure" open>
            <summary>
              <span>
                <small>Host Settings</small>
                <strong>Game settings</strong>
              </span>
              {!state.me.is_host && <i>View only</i>}
            </summary>
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
                <span className="field-label">Time per round</span>
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
                <span className="field-label">Reveal duration</span>
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
                <span className="field-label">Music library</span>
                <select
                  className="input"
                  value={shownSettings.song_pack}
                  disabled={!state.me.is_host || !demoTracksEnabled}
                  onChange={(event) =>
                    setSettings({ ...settings, song_pack: event.target.value })
                  }
                >
                  <option value="dynamic">
                    Licensed human tracks + original AI tracks
                  </option>
                  {demoTracksEnabled && (
                    <option value="demo">Local demo fixtures</option>
                  )}
                </select>
              </label>
              <label className="switch-row">
                <span>
                  <strong>Wrong answer penalty</strong>
                  <small>−500 points for a wrong answer</small>
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
                  <strong>Allow answer changes</strong>
                  <small>
                    Players can change their answer until time runs out
                  </small>
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
                  <output>
                    {Math.round(shownSettings.music_volume * 100)}%
                  </output>
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
            <p className="settings-summary">{settingsSummary}</p>
            {state.me.is_host && (
              <Button
                variant="secondary"
                disabled={busyAction !== null || !hasUnsavedSettings}
                onClick={() => void saveSettings()}
              >
                {busyAction === "settings" ? (
                  <Spinner label="Saving" />
                ) : (
                  "Save Settings"
                )}
              </Button>
            )}
            {saveStatus && (
              <p className="settings-save-success" role="status">
                {saveStatus}
              </p>
            )}
          </details>
        </Panel>

        {actionError && <StatusMessage>{actionError}</StatusMessage>}

        <div className="lobby-actions">
          <Button
            className={
              state.me.is_ready ? "ready-toggle active" : "ready-toggle"
            }
            variant={state.me.is_ready ? "secondary" : "primary"}
            disabled={busyAction !== null}
            onClick={toggleReady}
          >
            {busyAction === "ready" ? (
              <Spinner label="Updating" />
            ) : state.me.is_ready ? (
              "Ready ✓"
            ) : (
              "Mark as Ready"
            )}
          </Button>
          {state.me.is_host && (
            <>
              <Button
                disabled={!gate.canStart || busyAction !== null}
                onClick={startGame}
              >
                {busyAction === "start" ? (
                  <Spinner label="Starting" />
                ) : (
                  "Start Game"
                )}
              </Button>
              <p
                className={`start-gate ${gate.canStart ? "gate-open" : ""}`}
                role="status"
              >
                {gate.canStart
                  ? "All players are ready"
                  : `Waiting for all players to be ready — ${ready}/${state.players.length}`}
              </p>
            </>
          )}
          <Button
            variant="ghost"
            disabled={busyAction === "leave"}
            onClick={() => {
              if (
                !state.me.is_host ||
                window.confirm(
                  "Leave this room? Another connected player will become host.",
                )
              ) {
                void onLeave();
              }
            }}
          >
            Leave Room
          </Button>
        </div>
      </aside>
    </div>
  );
}
