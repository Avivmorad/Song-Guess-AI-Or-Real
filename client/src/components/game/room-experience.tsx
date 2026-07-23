"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { SiteHeader } from "@/components/brand";
import { Button, Spinner, StatusMessage } from "@/components/ui";
import { useRoomController } from "@/hooks/use-room-controller";
import { GameScreens } from "./game-screens";
import { LobbyScreen } from "./lobby-screen";

export function RoomExperience({ code }: { code: string }) {
  const router = useRouter();
  const controller = useRoomController(code);

  async function leaveAndReturnHome() {
    if (await controller.leave()) router.replace("/");
  }

  if (!controller.state && !controller.fatalError) {
    return (
      <main className="room-page state-page">
        <SiteHeader roomCode={code} />
        <div className="full-state">
          <Spinner label="Reconnecting to the room" />
        </div>
      </main>
    );
  }

  if (controller.fatalError) {
    const notMember = controller.fatalError.code === "NOT_IN_ROOM";
    return (
      <main className="room-page state-page">
        <SiteHeader />
        <section className="full-state error-state">
          <span className="state-code">
            {controller.fatalError.code === "BACKEND_NOT_CONFIGURED"
              ? "SETUP"
              : "404"}
          </span>
          <p className="eyebrow">Room unavailable</p>
          <h1>
            {notMember
              ? "Join before you enter."
              : controller.fatalError.message}
          </h1>
          <p>
            {notMember
              ? "This browser does not have a player session for the requested room."
              : "Check the room code with the host, or create a fresh listening room."}
          </p>
          <div className="state-actions">
            {notMember && (
              <Link
                className="button button-primary"
                href={`/join?code=${code}`}
              >
                Join room {code}
              </Link>
            )}
            <Link className="button button-secondary" href="/">
              Return home
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const state = controller.state!;
  return (
    <main className={`room-page phase-${state.room.phase}`}>
      <SiteHeader
        roomCode={state.room.phase === "lobby" ? undefined : state.room.code}
      />
      <div className="room-content">
        {state.room.phase === "lobby" ? (
          <LobbyScreen
            state={state}
            busyAction={controller.busyAction}
            actionError={controller.actionError}
            onReady={controller.toggleReady}
            onSaveSettings={controller.saveSettings}
            onStart={controller.beginGame}
            onRemove={controller.remove}
            onLeave={leaveAndReturnHome}
          />
        ) : (
          <GameScreens
            state={state}
            serverOffsetMs={controller.serverOffsetMs}
            busyAction={controller.busyAction}
            actionError={controller.actionError}
            preparationProgress={controller.preparationProgress}
            onAnswer={controller.answer}
            onAgain={controller.again}
            onAudioReady={controller.reportAudioReady}
            onRetryPreparation={controller.retryPreparation}
            onSkipPreparation={controller.skipPreparation}
            onRemove={controller.remove}
            onLeave={leaveAndReturnHome}
          />
        )}
      </div>

      {controller.connectionLost && (
        <div
          className="connection-overlay"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="connection-title"
        >
          <section>
            <span className="offline-pulse" aria-hidden="true" />
            <p className="eyebrow">Connection interrupted</p>
            <h2 id="connection-title">We’re holding your place.</h2>
            <p>
              Your session and submitted answer are safe. Reconnect to resume
              the current round.
            </p>
            <Button onClick={controller.refresh}>Try again</Button>
          </section>
        </div>
      )}

      <div className="sr-status" aria-live="polite">
        {controller.actionError && (
          <StatusMessage>{controller.actionError}</StatusMessage>
        )}
      </div>
    </main>
  );
}
