"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowIcon, BoltIcon, UserIcon, VolumeIcon } from "@/components/icons";
import { SiteHeader } from "@/components/brand";
import { Button, Field } from "@/components/ui";
import { normalizeNickname } from "@/lib/game/types";

export function LandingPage() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");

  function continueTo(path: "/create" | "/join") {
    const clean = normalizeNickname(nickname);
    if (clean.length < 2) {
      setError("Enter a nickname with at least 2 characters.");
      return;
    }
    window.localStorage.setItem("song-guess-nickname", clean);
    router.push(`${path}?nickname=${encodeURIComponent(clean)}`);
  }

  return (
    <main>
      <div className="landing-shell">
        <SiteHeader />
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">
              <span /> AI Music Showdown
            </p>
            <h1>
              Banger or Bot?
              <span>Can you hear the difference?</span>
            </h1>
            <p className="hero-summary">
              Listen to the track, decide if it was made by a human or AI, and
              beat your friends to the answer.
            </p>
            <div className="hero-form">
              <Field
                id="hero-nickname"
                label="Your nickname"
                value={nickname}
                onChange={(event) => {
                  setNickname(event.target.value);
                  setError("");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") continueTo("/create");
                }}
                error={error}
                placeholder="What should we call you?"
                autoComplete="nickname"
                maxLength={20}
              />
              <div className="hero-actions">
                <Button onClick={() => continueTo("/create")}>
                  Host a Game <ArrowIcon aria-hidden="true" />
                </Button>
                <Button variant="secondary" onClick={() => continueTo("/join")}>
                  Join a Game
                </Button>
              </div>
            </div>
            <div className="hero-proof" aria-label="Game highlights">
              <span>
                <UserIcon aria-hidden="true" /> 1–8 players
              </span>
              <span>
                <VolumeIcon aria-hidden="true" /> Live synchronized audio
              </span>
              <span>
                <BoltIcon aria-hidden="true" /> Speed scoring
              </span>
            </div>
          </div>
          <div className="hero-visual" aria-hidden="true">
            <div className="record-card">
              <div className="record">
                <div className="record-label">
                  <span>?</span>
                </div>
              </div>
              <div className="equalizer">
                {Array.from({ length: 18 }, (_, index) => (
                  <i key={index} />
                ))}
              </div>
              <div className="visual-question">
                <span>Now playing</span>
                <strong>
                  Banger
                  <br />
                  or Bot?
                </strong>
              </div>
            </div>
            <span className="sticker sticker-ai">
              BOT
              <br />
              MADE?
            </span>
            <span className="sticker sticker-real">
              HUMAN
              <br />
              MADE?
            </span>
          </div>
        </section>
      </div>

      <section className="how-section" aria-labelledby="guide-title">
        <div className="section-heading">
          <p className="eyebrow">
            <span /> Quick Start
          </p>
          <h2 id="guide-title">Start playing in a few taps.</h2>
        </div>
        <div className="guide-grid">
          <article className="guide-card" id="how-to-play">
            <p className="eyebrow">How to Play</p>
            <h3>Hear it. Choose. Score.</h3>
            <ol>
              <li>Join a room</li>
              <li>Listen to the track</li>
              <li>Choose who made it</li>
              <li>Answer before time runs out</li>
              <li>Earn points and climb the leaderboard</li>
            </ol>
          </article>
          <article className="guide-card" id="how-to-host">
            <p className="eyebrow">How to Host</p>
            <h3>Set up and bring your friends.</h3>
            <ol>
              <li>Pick a nickname</li>
              <li>Create a room</li>
              <li>Share the room code or invite link</li>
              <li>Wait for players and confirm they are ready</li>
              <li>Start the game</li>
            </ol>
          </article>
        </div>
      </section>

      <footer className="site-footer">
        <p>Banger or Bot</p>
        <span>Original demo music · No commercial recordings</span>
      </footer>
    </main>
  );
}
