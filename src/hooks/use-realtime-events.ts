import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { IntelEvent } from "@/components/intel-card";

export type RealtimeTransport = "websocket" | "sse";
export type RealtimeStatus = "connecting" | "connected" | "error" | "idle";

const STORAGE_KEY = "geopulse.realtime.transport";

export function getStoredTransport(): RealtimeTransport {
  if (typeof window === "undefined") return "websocket";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "sse" || v === "websocket" ? v : "websocket";
}

export function setStoredTransport(t: RealtimeTransport) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, t);
}

type Handlers = {
  onInsert?: (e: IntelEvent) => void;
  onUpdate?: (e: IntelEvent) => void;
  onDelete?: (id: string) => void;
};

type Options = Handlers & {
  transport: RealtimeTransport;
  /** When the chosen transport fails, automatically try the other. */
  autoFallback?: boolean;
};

/**
 * Manages a single live subscription for the events feed, with the choice of
 * Supabase Realtime (WebSocket) or a server-sent events stream. If the chosen
 * transport fails to connect, the hook transparently switches to the other.
 */
export function useRealtimeEvents(opts: Options) {
  const { transport, autoFallback = true } = opts;
  const handlersRef = useRef<Handlers>(opts);
  handlersRef.current = opts;

  const [status, setStatus] = useState<RealtimeStatus>("connecting");
  const [activeTransport, setActiveTransport] = useState<RealtimeTransport>(transport);

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | null = null;
    let triedFallback = false;
    setStatus("connecting");
    setActiveTransport(transport);

    const start = (t: RealtimeTransport) => {
      if (disposed) return;
      setActiveTransport(t);
      cleanup?.();
      cleanup =
        t === "websocket"
          ? startWebSocket(handlersRef, setStatus, onFail)
          : startSSE(handlersRef, setStatus, onFail);
    };

    const onFail = () => {
      if (disposed) return;
      if (autoFallback && !triedFallback) {
        triedFallback = true;
        const next: RealtimeTransport = transport === "websocket" ? "sse" : "websocket";
        start(next);
      }
    };

    start(transport);

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [transport, autoFallback]);

  return { status, activeTransport };
}

function startWebSocket(
  handlersRef: React.MutableRefObject<Handlers>,
  setStatus: (s: RealtimeStatus) => void,
  onFail: () => void,
): () => void {
  let failed = false;
  const channel = supabase
    .channel("events-live")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "events" }, (p) => {
      handlersRef.current.onInsert?.(p.new as IntelEvent);
    })
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "events" }, (p) => {
      handlersRef.current.onUpdate?.(p.new as IntelEvent);
    })
    .on("postgres_changes", { event: "DELETE", schema: "public", table: "events" }, (p) => {
      const id = (p.old as { id?: string }).id;
      if (id) handlersRef.current.onDelete?.(id);
    })
    .subscribe((s) => {
      if (s === "SUBSCRIBED") setStatus("connected");
      else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") {
        setStatus("error");
        if (!failed) {
          failed = true;
          onFail();
        }
      }
    });

  const failTimer = setTimeout(() => {
    if (!failed) {
      failed = true;
      setStatus("error");
      onFail();
    }
  }, 8000);

  return () => {
    clearTimeout(failTimer);
    supabase.removeChannel(channel);
  };
}

function startSSE(
  handlersRef: React.MutableRefObject<Handlers>,
  setStatus: (s: RealtimeStatus) => void,
  onFail: () => void,
): () => void {
  if (typeof window === "undefined" || typeof EventSource === "undefined") {
    setStatus("error");
    onFail();
    return () => {};
  }
  const since = new Date().toISOString();
  const es = new EventSource(`/api/public/events-stream?since=${encodeURIComponent(since)}`);
  let failed = false;

  es.addEventListener("ready", () => setStatus("connected"));
  es.addEventListener("event", (ev) => {
    try {
      const row = JSON.parse((ev as MessageEvent).data) as IntelEvent;
      handlersRef.current.onInsert?.(row);
    } catch {
      /* ignore malformed frame */
    }
  });
  es.onerror = () => {
    if (es.readyState === EventSource.CLOSED) {
      setStatus("error");
      if (!failed) {
        failed = true;
        onFail();
      }
    }
  };

  return () => es.close();
}
