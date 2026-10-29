"use client";

import { useEffect, useState } from "react";
import { Check, Pause, Play, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export function FocusTimer({
  open,
  onOpenChange,
  title,
  minutes,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  minutes: number;
  onDone: () => void;
}) {
  const total = minutes * 60;
  const [left, setLeft] = useState(total);
  const [running, setRunning] = useState(true);

  useEffect(() => {
    if (open) {
      setLeft(total);
      setRunning(true);
    }
  }, [open, total]);

  useEffect(() => {
    if (!open || !running) return;
    const t = setInterval(() => {
      setLeft((l) => {
        if (l <= 1) {
          clearInterval(t);
          setRunning(false);
          toast.success("Time! Nice focus. Done, or 5 more minutes?");
          return 0;
        }
        return l - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [open, running]);

  const pct = total ? (total - left) / total : 0;
  const r = 88;
  const c = 2 * Math.PI * r;
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm gap-5 p-6 text-center sm:max-w-sm">
        <DialogTitle className="text-sm font-semibold uppercase tracking-wide text-primary">Focus mode</DialogTitle>
        <DialogDescription className="text-base font-semibold text-foreground">{title}</DialogDescription>
        <div className="relative mx-auto size-52">
          <svg viewBox="0 0 200 200" className="size-full -rotate-90">
            <circle cx="100" cy="100" r={r} fill="none" stroke="var(--secondary)" strokeWidth="12" />
            <circle
              cx="100"
              cy="100"
              r={r}
              fill="none"
              stroke="var(--primary)"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - pct)}
              className="transition-[stroke-dashoffset] duration-1000 ease-linear"
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <span className="text-5xl font-extrabold tabular-nums">{mm}:{ss}</span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">Just this one thing. Everything else can wait.</p>
        <div className="flex justify-center gap-2">
          {left > 0 ? (
            <Button variant="outline" size="lg" onClick={() => setRunning((r) => !r)}>
              {running ? <><Pause /> Pause</> : <><Play /> Resume</>}
            </Button>
          ) : (
            <Button variant="outline" size="lg" onClick={() => { setLeft(5 * 60); setRunning(true); }}>
              <RotateCcw /> +5 min
            </Button>
          )}
          <Button size="lg" onClick={onDone}>
            <Check /> Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
