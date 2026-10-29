"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Coffee, Pause, Play, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Phase = "focus" | "ask" | "break";
const SPRINTS = [2, 10, 15, 25];
const HYPERFOCUS_SEC = 45 * 60;

/** `?fast=1` makes 1 minute pass in 5 seconds (demo + tests). */
const speed = () => (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("fast") ? 12 : 1);

export function FocusTimer({
  open,
  onOpenChange,
  title,
  startMinutes,
  onDone,
  onStop,
  onPark,
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  startMinutes: number;
  onDone: (focusSec: number) => void;
  onStop: (focusSec: number) => void;
  onPark: (thought: string) => void;
  children?: React.ReactNode; // body-double room
}) {
  const [phase, setPhase] = useState<Phase>("focus");
  const [total, setTotal] = useState(startMinutes * 60);
  const [left, setLeft] = useState(startMinutes * 60);
  const [running, setRunning] = useState(true);
  const [thought, setThought] = useState("");
  const focused = useRef(0);
  const nudged = useRef(false);
  const lastSprint = useRef(startMinutes);

  function start(min: number, p: Phase = "focus") {
    if (p === "focus") lastSprint.current = min;
    setPhase(p);
    setTotal(min * 60);
    setLeft(min * 60);
    setRunning(true);
  }

  useEffect(() => {
    if (!open) return;
    focused.current = 0;
    nudged.current = false;
    start(startMinutes);
  }, [open, startMinutes]);

  // Tick
  useEffect(() => {
    if (!open || !running || phase === "ask") return;
    const t = setInterval(() => {
      if (phase === "focus") {
        focused.current += 1;
        if (!nudged.current && focused.current >= HYPERFOCUS_SEC) {
          nudged.current = true;
          toast("💧 Hyperfocus check: drink water, stretch, eat something?", { duration: 8000 });
        }
      }
      setLeft((l) => Math.max(0, l - 1));
    }, 1000 / speed());
    return () => clearInterval(t);
  }, [open, running, phase]);

  // Time's up → ask, never auto-continue
  useEffect(() => {
    if (open && left === 0 && phase !== "ask") setPhase("ask");
  }, [open, left, phase]);

  // Gentle nudge when they come back from another tab/app
  useEffect(() => {
    if (!open) return;
    const onVis = () => {
      if (document.visibilityState === "visible" && phase === "focus") toast(`Welcome back 👋 Still on: ${title}`);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [open, phase, title]);

  function park() {
    const t = thought.trim();
    if (!t) return;
    onPark(t);
    setThought("");
    toast("Parked 💭 Back to it.");
  }

  const frac = total ? left / total : 0;
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  const isBreak = phase === "break";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] max-w-sm gap-4 overflow-y-auto p-5 text-center sm:max-w-sm">
        <DialogTitle className={cn("text-sm font-semibold uppercase tracking-wide", isBreak ? "text-sky-600" : "text-primary")}>
          {phase === "ask" ? "Time!" : isBreak ? "Break" : total === 120 ? "Just 2 minutes" : "Focus"}
        </DialogTitle>
        <DialogDescription className="text-base font-semibold text-foreground">{isBreak ? "Rest your eyes. Stretch. Drink water." : title}</DialogDescription>

        {phase === "ask" ? (
          <div className="grid gap-2 py-2">
            <p className="pb-2 text-2xl font-extrabold">Keep going or stop?</p>
            <Button size="lg" className="h-12 rounded-2xl text-base" onClick={() => start(10)}>
              <Play /> Keep going · 10 min
            </Button>
            <Button size="lg" variant="outline" className="h-12 rounded-2xl" onClick={() => onDone(focused.current)}>
              <Check /> I finished this step
            </Button>
            {lastSprint.current >= 10 && (
              <Button size="lg" variant="outline" className="h-12 rounded-2xl" onClick={() => start(5, "break")}>
                <Coffee /> 5-min break
              </Button>
            )}
            <Button variant="ghost" className="h-11" onClick={() => onStop(focused.current)}>
              Stop here. That still counts 💚
            </Button>
          </div>
        ) : (
          <>
            <div className="relative mx-auto size-48">
              {/* Visual time: the coloured disc shrinks as time runs out */}
              <svg viewBox="0 0 200 200" className="size-full">
                <circle cx="100" cy="100" r="96" fill="var(--secondary)" />
                <path d={wedge(frac)} fill={isBreak ? "#38bdf8" : "var(--primary)"} />
              </svg>
              <div className="absolute inset-0 grid place-items-center">
                <span className="rounded-2xl bg-background/85 px-3 py-1 text-4xl font-extrabold tabular-nums shadow-sm">{mm}:{ss}</span>
              </div>
            </div>
            {!isBreak && (
              <div className="flex justify-center gap-1.5" role="group" aria-label="Sprint length">
                {SPRINTS.map((m) => (
                  <button
                    key={m}
                    onClick={() => start(m)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-semibold",
                      total === m * 60 ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary",
                    )}
                  >
                    {m} min
                  </button>
                ))}
              </div>
            )}
            <div className="flex justify-center gap-2">
              <Button variant="outline" size="lg" onClick={() => setRunning((r) => !r)}>
                {running ? <><Pause /> Pause</> : <><Play /> Resume</>}
              </Button>
              {!isBreak && (
                <Button size="lg" onClick={() => onDone(focused.current)}>
                  <Check /> Done
                </Button>
              )}
            </div>
          </>
        )}

        {children}

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            park();
          }}
        >
          <input
            value={thought}
            onChange={(e) => setThought(e.target.value)}
            placeholder="💭 Random thought? Park it here"
            aria-label="Park a distracting thought"
            className="h-10 min-w-0 flex-1 rounded-xl border border-input bg-background px-3 text-sm"
          />
          <Button type="submit" variant="outline" size="icon-lg" aria-label="Park thought" disabled={!thought.trim()}>
            <Send />
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** SVG pie wedge for the remaining fraction, starting at 12 o'clock, clockwise. */
function wedge(frac: number) {
  if (frac >= 0.9999) return "M100,4 A96,96 0 1,1 99.99,4 Z";
  if (frac <= 0) return "";
  const a = frac * 2 * Math.PI;
  const x = 100 + 96 * Math.sin(a);
  const y = 100 - 96 * Math.cos(a);
  return `M100,100 L100,4 A96,96 0 ${frac > 0.5 ? 1 : 0},1 ${x.toFixed(2)},${y.toFixed(2)} Z`;
}
