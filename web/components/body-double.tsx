"use client";

import { useEffect, useState } from "react";
import { onDisconnect, onValue, ref, remove, serverTimestamp, set } from "firebase/database";
import { useAuth } from "@/components/auth-provider";
import { rtdb } from "@/lib/firebase";

type Peer = { name: string; since: number };

/** Live study room (Realtime DB presence). `active` = I'm focusing right now. */
export function useFocusRoom(active: boolean) {
  const { user } = useAuth();
  const [peers, setPeers] = useState<Record<string, Peer>>({});

  useEffect(() => {
    if (!user) return;
    return onValue(
      ref(rtdb, "focus"),
      (snap) => setPeers((snap.val() as Record<string, Peer> | null) ?? {}),
      () => setPeers({}),
    );
  }, [user]);

  useEffect(() => {
    if (!user || !active) return;
    const me = ref(rtdb, `focus/${user.uid}`);
    const name = user.isAnonymous ? "Guest" : (user.displayName?.split(" ")[0] ?? "Student").slice(0, 40);
    onDisconnect(me).remove();
    set(me, { name, since: serverTimestamp() }).catch(() => {});
    return () => {
      remove(me).catch(() => {});
    };
  }, [user, active]);

  return { peers, me: user?.uid };
}

/** Shown inside the focus timer: an always-present companion + the real people focusing now. */
export function BodyDouble() {
  const { peers, me } = useFocusRoom(true);
  const others = Object.entries(peers).filter(([uid]) => uid !== me);
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-secondary/60 p-3 text-left">
      <Kasama />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">
          {others.length ? `👥 ${others.length} studying with you now` : "Kasama is studying with you"}
        </p>
        {others.length > 0 ? (
          <div className="mt-1 flex -space-x-1.5">
            {others.slice(0, 6).map(([uid, p]) => (
              <span key={uid} title={p.name} className="grid size-6 place-items-center rounded-full border-2 border-background bg-primary text-[10px] font-bold text-primary-foreground">
                {p.name[0]?.toUpperCase()}
              </span>
            ))}
            {others.length > 6 && <span className="pl-2.5 text-xs text-muted-foreground">+{others.length - 6}</span>}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Live study room · others appear here when they focus</p>
        )}
      </div>
    </div>
  );
}

/** Live counter for the home screen. */
export function FocusingNow() {
  const { peers } = useFocusRoom(false);
  const n = Object.keys(peers).length;
  if (!n) return null;
  return (
    <p className="flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground">
      <span className="relative flex size-2.5">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
        <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
      </span>
      {n} student{n === 1 ? " is" : "s are"} focusing right now
    </p>
  );
}

/** Kasama: a tiny companion typing at a laptop. */
function Kasama() {
  return (
    <svg viewBox="0 0 64 64" className="size-14 shrink-0" aria-label="Kasama, your study companion" role="img">
      <g style={{ animation: "kasama-bob 3s ease-in-out infinite" }}>
        <circle cx="32" cy="20" r="11" fill="#f2c9a0" />
        <path d="M21 18c0-8 22-10 22 0-3-4-8-5-11-5s-8 1-11 5z" fill="#2b2b2b" />
        <g style={{ animation: "kasama-blink 4s infinite", transformOrigin: "32px 21px" }}>
          <circle cx="28" cy="21" r="1.4" fill="#2b2b2b" />
          <circle cx="36" cy="21" r="1.4" fill="#2b2b2b" />
        </g>
        <path d="M29 26q3 2 6 0" stroke="#2b2b2b" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        <path d="M18 46c0-9 6-14 14-14s14 5 14 14z" fill="var(--primary)" />
      </g>
      <rect x="14" y="44" width="36" height="4" rx="1.5" fill="#94a3b8" />
      <path d="M19 44l4-11h18l4 11z" fill="#cbd5e1" />
      <circle cx="24" cy="44" r="3" fill="#f2c9a0" style={{ animation: "kasama-type 0.35s ease-in-out infinite alternate" }} />
      <circle cx="40" cy="44" r="3" fill="#f2c9a0" style={{ animation: "kasama-type 0.35s ease-in-out 0.17s infinite alternate" }} />
    </svg>
  );
}
