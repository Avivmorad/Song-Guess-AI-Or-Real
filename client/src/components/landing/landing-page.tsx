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
              <span /> Live music deception
            </p>
            <h1>
              Trust your ears.
              <span>Question everything.</span>
            </h1>
            <p className="hero-summary">
              A real-time music showdown. Listen together, decide who made the
              track, and score faster than your friends.
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
                  Create a room <ArrowIcon aria-hidden="true" />
                </Button>
                <Button variant="secondary" onClick={() => continueTo("/join")}>
                  Join with a code
                </Button>
              </div>
            </div>
            <div className="hero-proof" aria-label="Game highlights">
              <span>
                <UserIcon aria-hidden="true" /> 2–8 players
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
                  Human instinct
                  <br />
                  or machine precision?
                </strong>
              </div>
            </div>
            <span className="sticker sticker-ai">
              AI
              <br />
              MADE?
            </span>
            <span className="sticker sticker-real">
              REAL
              <br />
              DEAL?
            </span>
          </div>
        </section>
      </div>

      <section className="how-section" id="how-to-play">
        <div className="section-heading">
          <p className="eyebrow">
            <span /> Three beats to glory
          </p>
          <h2>Hear it. Call it. Own the leaderboard.</h2>
        </div>
        <ol className="how-grid">
          <li>
            <span>01</span>
            <h3>Get the room together</h3>
            <p>
              Share a six-character code and ready up with as many as eight
              players.
            </p>
          </li>
          <li>
            <span>02</span>
            <h3>Listen, then commit</h3>
            <p>
              Every browser gets the same clip and deadline. Pick AI made or
              human made.
            </p>
          </li>
          <li>
            <span>03</span>
            <h3>Reveal and rank</h3>
            <p>
              Correct calls earn 1,000 points plus a speed bonus. Hesitation
              costs.
            </p>
          </li>
        </ol>
      </section>

      <footer className="site-footer">
        <p>Song Guess: AI Or Real</p>
        <span>Original demo music · No commercial recordings</span>
      </footer>
    </main>
  );
}
