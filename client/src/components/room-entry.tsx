"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowIcon } from "@/components/icons";
import { Button, Field, Panel, Spinner, StatusMessage } from "@/components/ui";
import {
  DEFAULT_SETTINGS,
  normalizeNickname,
  normalizeRoomCode,
  type GameSettings,
} from "@/lib/game/types";
import { createRoom, GameApiError, joinRoom } from "@/lib/supabase/game-api";
import { isBackendConfigured } from "@/lib/supabase/config";

function useInitialNickname(initialNickname: string) {
  const [nickname, setNickname] = useState(initialNickname);
  useEffect(() => {
    if (!nickname) setNickname(window.localStorage.getItem("song-guess-nickname") || "");
  }, [nickname]);
  return [nickname, setNickname] as const;
}

export function CreateRoomForm({ initialNickname }: { initialNickname: string }) {
  const router = useRouter();
  const [nickname, setNickname] = useInitialNickname(initialNickname);
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const cleanNickname = normalizeNickname(nickname);
    if (cleanNickname.length < 2) {
      setError("Use a nickname between 2 and 20 characters.");
      return;
    }
    if (!isBackendConfigured()) {
      setError("The multiplayer service is not configured yet.");
      return;
    }
    setIsSubmitting(true);
    setError("");
    try {
      const state = await createRoom(cleanNickname, settings);
      window.localStorage.setItem("song-guess-nickname", cleanNickname);
      router.replace(`/room/${state.room.code}`);
    } catch (caught) {
      setError(caught instanceof GameApiError ? caught.message : "The room could not be created.");
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="entry-grid">
      <Panel className="entry-panel">
        <div className="panel-heading">
          <span className="step-number">01</span>
          <div><p className="eyebrow">Player</p><h2>Choose your name</h2></div>
        </div>
        <Field
          id="create-nickname"
          label="Nickname"
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          placeholder="Your stage name"
          autoComplete="nickname"
          maxLength={20}
        />
      </Panel>

      <Panel className="entry-panel settings-entry">
        <div className="panel-heading">
          <span className="step-number">02</span>
          <div><p className="eyebrow">Game setup</p><h2>Set the tempo</h2></div>
        </div>
        <div className="settings-grid compact-settings">
          <label className="field">
            <span className="field-label">Rounds</span>
            <select
              className="input"
              value={settings.round_count}
              onChange={(event) => setSettings({ ...settings, round_count: Number(event.target.value) })}
            >
              {[3, 4, 5, 6].map((value) => <option key={value} value={value}>{value} rounds</option>)}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Answer time</span>
            <select
              className="input"
              value={settings.round_duration_seconds}
              onChange={(event) => setSettings({ ...settings, round_duration_seconds: Number(event.target.value) })}
            >
              {[15, 20, 30, 45].map((value) => <option key={value} value={value}>{value} seconds</option>)}
            </select>
          </label>
          <label className="switch-row">
            <span><strong>Wrong-answer penalty</strong><small>Lose 500 points for a miss</small></span>
            <input
              type="checkbox"
              checked={settings.negative_points}
              onChange={(event) => setSettings({ ...settings, negative_points: event.target.checked })}
            />
          </label>
          <label className="switch-row">
            <span><strong>Change answers</strong><small>Allow edits before time expires</small></span>
            <input
              type="checkbox"
              checked={settings.allow_answer_changes}
              onChange={(event) => setSettings({ ...settings, allow_answer_changes: event.target.checked })}
            />
          </label>
        </div>
      </Panel>

      <div className="entry-submit">
        {error && <StatusMessage>{error}</StatusMessage>}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Spinner label="Creating room" /> : <>Open the lobby <ArrowIcon aria-hidden="true" /></>}
        </Button>
        <p>Your settings can still be changed in the lobby.</p>
      </div>
    </form>
  );
}

export function JoinRoomForm({
  initialNickname,
  initialCode,
}: {
  initialNickname: string;
  initialCode: string;
}) {
  const router = useRouter();
  const [nickname, setNickname] = useInitialNickname(initialNickname);
  const [code, setCode] = useState(normalizeRoomCode(initialCode));
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const cleanNickname = normalizeNickname(nickname);
    const cleanCode = normalizeRoomCode(code);
    if (cleanNickname.length < 2) {
      setError("Use a nickname between 2 and 20 characters.");
      return;
    }
    if (cleanCode.length !== 6) {
      setError("Enter the complete six-character room code.");
      return;
    }
    if (!isBackendConfigured()) {
      setError("The multiplayer service is not configured yet.");
      return;
    }
    setIsSubmitting(true);
    setError("");
    try {
      const state = await joinRoom(cleanCode, cleanNickname);
      window.localStorage.setItem("song-guess-nickname", cleanNickname);
      router.replace(`/room/${state.room.code}`);
    } catch (caught) {
      setError(caught instanceof GameApiError ? caught.message : "The room could not be joined.");
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="join-card">
      <div className="join-card-heading">
        <p className="eyebrow">Enter the session</p>
        <h1>Join the listening room.</h1>
        <p>Ask the host for the six-character code shown in their lobby.</p>
      </div>
      <Field
        id="join-code"
        label="Room code"
        value={code}
        onChange={(event) => setCode(normalizeRoomCode(event.target.value))}
        placeholder="ABC234"
        autoComplete="off"
        maxLength={6}
        inputMode="text"
        className="code-input"
      />
      <Field
        id="join-nickname"
        label="Nickname"
        value={nickname}
        onChange={(event) => setNickname(event.target.value)}
        placeholder="Your stage name"
        autoComplete="nickname"
        maxLength={20}
      />
      {error && <StatusMessage>{error}</StatusMessage>}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? <Spinner label="Joining room" /> : <>Join room <ArrowIcon aria-hidden="true" /></>}
      </Button>
      <p className="join-footnote">Your browser keeps a private session so refreshes can reconnect you.</p>
    </form>
  );
}
