"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AnswerChoice, GameSettings, RoomState } from "@/lib/game/types";
import {
  GameApiError,
  getRoomState,
  heartbeat,
  leaveRoom,
  markRoundAudioReady,
  playAgain,
  prepareRound,
  removePlayer,
  setReady,
  startGame,
  submitAnswer,
  subscribeToRoom,
  unsubscribeFromRoom,
  updateSettings,
} from "@/lib/supabase/game-api";

type ActionName =
  | "ready"
  | "settings"
  | "start"
  | "answer"
  | "audio"
  | "remove"
  | "leave"
  | "again"
  | "retry"
  | null;

export function useRoomController(code: string) {
  const [state, setState] = useState<RoomState | null>(null);
  const [fatalError, setFatalError] = useState<GameApiError | null>(null);
  const [actionError, setActionError] = useState("");
  const [connectionLost, setConnectionLost] = useState(false);
  const [busyAction, setBusyAction] = useState<ActionName>(null);
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const refreshInFlight = useRef(false);
  const preparationInFlight = useRef(false);
  const mounted = useRef(true);
  const preparationRoundId =
    state?.room.phase === "preparing" ? state.round?.id : null;
  const preparationStatus =
    state?.room.phase === "preparing"
      ? state.round?.preparation_status
      : undefined;

  const acceptState = useCallback(
    (nextState: RoomState, startedAt = Date.now()) => {
      if (!mounted.current) return;
      const midpoint = (startedAt + Date.now()) / 2;
      setServerOffsetMs(new Date(nextState.server_now).getTime() - midpoint);
      setState(nextState);
      setFatalError(null);
      setConnectionLost(false);
    },
    [],
  );

  const refresh = useCallback(
    async (sendHeartbeat = false) => {
      if (refreshInFlight.current) return;
      refreshInFlight.current = true;
      const startedAt = Date.now();
      try {
        const next = sendHeartbeat
          ? await heartbeat(code)
          : await getRoomState(code);
        acceptState(next, startedAt);
      } catch (error) {
        const gameError =
          error instanceof GameApiError ? error : new GameApiError("UNKNOWN");
        if (!mounted.current) return;
        if (
          ["ROOM_NOT_FOUND", "NOT_IN_ROOM", "BACKEND_NOT_CONFIGURED"].includes(
            gameError.code,
          )
        ) {
          setFatalError(gameError);
        } else {
          setConnectionLost(true);
        }
      } finally {
        refreshInFlight.current = false;
      }
    },
    [acceptState, code],
  );

  useEffect(() => {
    mounted.current = true;
    const initialRefresh = window.setTimeout(() => void refresh(true), 0);
    return () => {
      window.clearTimeout(initialRefresh);
      mounted.current = false;
    };
  }, [refresh]);

  useEffect(() => {
    if (!state?.room.id) return;
    const channel = subscribeToRoom(state.room.id, () => void refresh(false));
    return () => {
      void unsubscribeFromRoom(channel);
    };
  }, [refresh, state?.room.id]);

  useEffect(() => {
    const phase = state?.room.phase;
    const delay = phase === "lobby" || phase === "finished" ? 3000 : 750;
    const interval = window.setInterval(() => void refresh(false), delay);
    return () => window.clearInterval(interval);
  }, [refresh, state?.room.phase]);

  useEffect(() => {
    if (!preparationRoundId) return;
    if (preparationStatus === "ready" || preparationStatus === "failed") {
      return;
    }
    const requestPreparation = async () => {
      if (preparationInFlight.current) return;
      preparationInFlight.current = true;
      try {
        const result = await prepareRound(code);
        if (result.status === "failed") {
          setActionError(
            new GameApiError(result.error_code || "PREPARATION_FAILED").message,
          );
        } else {
          await refresh(false);
        }
      } catch (error) {
        const gameError =
          error instanceof GameApiError
            ? error
            : new GameApiError("PREPARATION_FAILED");
        setActionError(gameError.message);
      } finally {
        preparationInFlight.current = false;
      }
    };
    void requestPreparation();
    const interval = window.setInterval(() => void requestPreparation(), 5_000);
    return () => window.clearInterval(interval);
  }, [code, preparationRoundId, preparationStatus, refresh]);

  useEffect(() => {
    const interval = window.setInterval(() => void refresh(true), 10_000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    const handleOffline = () => setConnectionLost(true);
    const handleOnline = () => void refresh(true);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [refresh]);

  const runAction = useCallback(
    async (
      name: Exclude<ActionName, null>,
      action: () => Promise<RoomState>,
    ) => {
      setBusyAction(name);
      setActionError("");
      const startedAt = Date.now();
      try {
        acceptState(await action(), startedAt);
        return true;
      } catch (error) {
        const gameError =
          error instanceof GameApiError ? error : new GameApiError("UNKNOWN");
        setActionError(gameError.message);
        if (
          gameError.code === "ROOM_NOT_FOUND" ||
          gameError.code === "NOT_IN_ROOM"
        ) {
          setFatalError(gameError);
        }
        return false;
      } finally {
        setBusyAction(null);
      }
    },
    [acceptState],
  );

  return {
    state,
    fatalError,
    actionError,
    clearActionError: () => setActionError(""),
    connectionLost,
    busyAction,
    serverOffsetMs,
    refresh: () => refresh(true),
    toggleReady: (ready: boolean) =>
      runAction("ready", () => setReady(code, ready)),
    saveSettings: (settings: GameSettings) =>
      runAction("settings", () => updateSettings(code, settings)),
    beginGame: () => runAction("start", () => startGame(code)),
    answer: (choice: AnswerChoice) =>
      runAction("answer", () => submitAnswer(code, choice)),
    reportAudioReady: (roundId: string) =>
      runAction("audio", () => markRoundAudioReady(code, roundId)),
    retryPreparation: async () => {
      setBusyAction("retry");
      setActionError("");
      try {
        const result = await prepareRound(code, true);
        if (result.status === "failed") {
          setActionError(
            new GameApiError(result.error_code || "PREPARATION_FAILED").message,
          );
          return false;
        }
        await refresh(false);
        return true;
      } catch (error) {
        const gameError =
          error instanceof GameApiError
            ? error
            : new GameApiError("PREPARATION_FAILED");
        setActionError(gameError.message);
        return false;
      } finally {
        setBusyAction(null);
      }
    },
    remove: (playerId: string) =>
      runAction("remove", () => removePlayer(code, playerId)),
    again: () => runAction("again", () => playAgain(code)),
    leave: async () => {
      setBusyAction("leave");
      setActionError("");
      try {
        await leaveRoom(code);
        return true;
      } catch (error) {
        const gameError =
          error instanceof GameApiError ? error : new GameApiError("UNKNOWN");
        setActionError(gameError.message);
        return false;
      } finally {
        setBusyAction(null);
      }
    },
  };
}
