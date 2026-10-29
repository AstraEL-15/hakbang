"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { ArrowLeft, CalendarDays, Check, Clock, Cpu, Loader2, PartyPopper, Play, Puzzle, Sparkles, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { LangToggle } from "@/components/lang-toggle";
import { FocusTimer } from "@/components/focus-timer";
import { useAuth } from "@/components/auth-provider";
import { StuckDialog } from "@/components/stuck-dialog";
import { db } from "@/lib/firebase";
import { postJson } from "@/lib/client";
import { dayLabel, newId, totalMinutes } from "@/lib/schedule";
import type { AiMeta, Lang, LogEntry, Project, Step, Stuck, StuckReason } from "@/lib/schemas";
import { cn } from "@/lib/utils";

const ENERGY = { low: "Easy", med: "Some focus", high: "Deep focus" } as const;
const fmtMin = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}`);

export default function PlanPage() {
  const { id } = useParams<{ id: string }>();
  const [p, setP] = useState<Project | null | undefined>(undefined);
  const [stuckBusy, setStuckBusy] = useState(false);
  const [cheer, setCheer] = useState<string | null>(null);
  const [stuckOpen, setStuckOpen] = useState(false);
  const [focus, setFocus] = useState(false);

  const { user } = useAuth();

  useEffect(() => {
    if (user === undefined) return; // wait for the session to restore
    if (user === null) return setP(null);
    return onSnapshot(
      doc(db, "projects", id),
      (snap) => setP(snap.exists() ? ({ id: snap.id, ...snap.data() } as Project) : null),
      (err) => {
        if (err.code !== "permission-denied") toast.error("Couldn't load your plan. Check the connection.");
        setP(null);
      },
    );
  }, [id, user]);

  const idx = p ? p.steps.findIndex((s) => s.status === "todo") : -1;
  const cur = p && idx >= 0 ? p.steps[idx] : null;
  const doneCount = p ? p.steps.filter((s) => s.status === "done").length : 0;
  const minutesLeft = p ? totalMinutes(p.steps.filter((s) => s.status === "todo")) : 0;
  const days = useMemo(() => {
    const m = new Map<string, Step[]>();
    p?.steps.forEach((s) => m.set(s.day, [...(m.get(s.day) ?? []), s]));
    return [...m.entries()];
  }, [p]);

  async function save(patch: Partial<Project>) {
    try {
      await updateDoc(doc(db, "projects", id), patch);
    } catch {
      toast.error("Couldn't save. Check the connection and try again.");
    }
  }

  function markDone() {
    if (!p || !cur) return;
    setFocus(false);
    setCheer(null);
    save({ steps: p.steps.map((s) => (s.id === cur.id ? { ...s, status: "done" } : s)) });
    const left = p.steps.length - doneCount - 1;
    toast.success(left ? (p.lang === "tl" ? "Ayan! Isang hakbang na. 🎉" : "Nice! One step down. 🎉") : "That was the last one! 🎉");
  }

  async function stuck(reason: StuckReason) {
    if (!p || !cur) return;
    setStuckOpen(false);
    setStuckBusy(true);
    setCheer(null);
    try {
      const { data, meta, label } = await postJson<{ data: Stuck; meta: AiMeta; label: string }>("/api/stuck", {
        projectTitle: p.title,
        step: { title: cur.title, detail: cur.detail, minutes: cur.minutes },
        lang: p.lang,
        reason,
        level: cur.level ?? 0,
      });
      const micro: Step[] = data.microSteps.map((m) => ({
        id: newId(),
        title: m.title,
        detail: `Part of: ${cur.title}`,
        minutes: m.minutes,
        energy: "low",
        status: "todo",
        day: cur.day,
        parentId: cur.id,
        level: (cur.level ?? 0) + 1,
        example: data.example || undefined,
      }));
      const log: LogEntry = { label, detail: `"${cur.title}" → ${micro.length} smaller step${micro.length === 1 ? "" : "s"}`, ms: meta.ms, model: meta.model === "ladder" ? undefined : meta.model };
      await save({ steps: [...p.steps.slice(0, idx), ...micro, ...p.steps.slice(idx + 1)], log: [...p.log, log] });
      setCheer(data.encouragement);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't split that step.");
    } finally {
      setStuckBusy(false);
    }
  }

  if (p === undefined)
    return (
      <main className="mx-auto w-full max-w-md space-y-4 px-4 pt-5">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-64 w-full rounded-3xl" />
        <Skeleton className="h-40 w-full" />
      </main>
    );

  if (p === null)
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-4xl">🧭</p>
        <h1 className="text-xl font-semibold">{user ? "We couldn't find that plan." : "Sign in to see your plan."}</h1>
        {user && <p className="text-sm text-muted-foreground">It may belong to another account.</p>}
        <Button nativeButton={false} render={<Link href="/" />}>{user ? "Start a new one" : "Go to sign in"}</Button>
      </main>
    );

  const today = new Date();
  const dl = new Date(p.deadline);
  const daysLeft = Math.max(0, Math.round((new Date(dl.getFullYear(), dl.getMonth(), dl.getDate()).getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86_400_000));
  const due = new Date(p.deadline).toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" });

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 pb-12 pt-5">
      <header className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="icon" nativeButton={false} render={<Link href="/" aria-label="Home" />}>
          <ArrowLeft />
        </Button>
        <LangToggle value={p.lang} onChange={(lang: Lang) => save({ lang })} />
      </header>

      <section className="space-y-2">
        <h1 className="text-xl font-bold leading-snug">{p.title}</h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1"><CalendarDays className="size-4" /> Due {due} · {daysLeft} day{daysLeft === 1 ? "" : "s"} left</span>
          <span className="inline-flex items-center gap-1"><Clock className="size-4" /> {fmtMin(minutesLeft)} to go</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${(doneCount / p.steps.length) * 100}%` }} />
          </div>
          <span className="text-xs font-semibold tabular-nums text-muted-foreground">{doneCount}/{p.steps.length}</span>
        </div>
        {p.overMinutes > 0 && (
          <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            This needs ~{fmtMin(p.overMinutes)} more than your daily time before the deadline. Add a little time per day to stay on track.
          </p>
        )}
      </section>

      {cur ? (
        <Card key={cur.id} className="gap-4 rounded-3xl border-primary/20 p-6 shadow-xl shadow-primary/10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold uppercase tracking-wide text-primary">
              Your next step
            </span>
            <Badge variant="secondary" className="gap-1"><Sparkles className="size-3" /> AI</Badge>
          </div>
          <h2 className="text-[1.7rem] font-extrabold leading-tight tracking-tight">{cur.title}</h2>
          {cur.detail && <p className="text-muted-foreground">{cur.detail}</p>}
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-secondary-foreground"><Clock className="size-3.5" /> {cur.minutes} min</span>
            <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">{ENERGY[cur.energy]}</span>
            <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">{dayLabel(cur.day)}</span>
          </div>
          {!!cur.level && (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800" title="Unstuck ladder: 15 → 5 → 2 min → just open the file">
              {[1, 2, 3].map((n) => (
                <span key={n} className={cn("h-1.5 w-6 rounded-full", n <= (cur.level ?? 0) ? "bg-amber-400" : "bg-muted")} />
              ))}
              <span className="ml-1">Smaller ×{cur.level}</span>
            </div>
          )}
          {cur.example && (
            <details className="rounded-xl border bg-muted/40 px-3 py-2 text-sm">
              <summary className="cursor-pointer font-semibold">📄 See an example <Badge variant="secondary" className="ml-1">AI</Badge></summary>
              <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{cur.example}</p>
            </details>
          )}
          {cheer && <p className="rounded-xl bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground animate-in fade-in">💚 {cheer}</p>}
          <div className="grid gap-2 pt-1">
            <Button size="lg" className="h-13 rounded-2xl text-base font-bold" onClick={() => setFocus(true)}>
              <Play /> Start focus · {cur.minutes} min
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="lg" className="h-12 rounded-2xl" onClick={markDone}>
                <Check /> Done
              </Button>
              <Button variant="outline" size="lg" className="h-12 rounded-2xl border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100" onClick={() => setStuckOpen(true)} disabled={stuckBusy}>
                {stuckBusy ? <><Loader2 className="animate-spin" /> Shrinking…</> : <><Puzzle /> I&apos;m stuck</>}
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="items-center gap-3 rounded-3xl p-8 text-center animate-in fade-in zoom-in-95">
          <PartyPopper className="size-12 text-primary" />
          <h2 className="text-2xl font-extrabold">{p.lang === "tl" ? "Tapos na lahat!" : "All done!"}</h2>
          <p className="text-muted-foreground">You finished {p.steps.length} steps, one at a time. That&apos;s how big things get done.</p>
          <Button nativeButton={false} render={<Link href="/" />}>Plan something else</Button>
        </Card>
      )}

      <section className="space-y-3">
        <h3 className="flex items-center gap-2 font-bold"><CalendarDays className="size-4 text-primary" /> Your schedule</h3>
        {days.map(([day, steps]) => (
          <Card key={day} className="gap-2 p-4">
            <div className="flex items-baseline justify-between">
              <span className="font-semibold">{dayLabel(day)}</span>
              <span className="text-xs text-muted-foreground">{fmtMin(totalMinutes(steps))} of {fmtMin(p.minutesPerDay)}</span>
            </div>
            <ul className="space-y-1.5">
              {steps.map((s) => (
                <li key={s.id} className={cn("flex items-start gap-2 text-sm", s.parentId && "pl-4", s.id === cur?.id && "font-semibold text-primary")}>
                  <span className={cn("mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border", s.status === "done" ? "border-primary bg-primary text-primary-foreground" : s.id === cur?.id ? "border-primary" : "border-muted-foreground/40")}>
                    {s.status === "done" && <Check className="size-3" />}
                  </span>
                  <span className={cn("flex-1", s.status === "done" && "text-muted-foreground line-through")}>{s.title}</span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{s.minutes}m</span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </section>

      <details className="rounded-2xl border bg-card p-4 text-sm">
        <summary className="flex cursor-pointer items-center gap-2 font-semibold"><Cpu className="size-4 text-primary" /> How Hakbang planned this</summary>
        <ol className="mt-3 space-y-2">
          {p.log.map((l, i) => (
            <li key={i} className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-primary" />
              <div>
                <p className="font-medium">{l.label}</p>
                <p className="text-muted-foreground">{l.detail}{l.model ? ` · ${l.model.split("/")[1]} · ${(l.ms / 1000).toFixed(1)}s` : ""}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-muted-foreground">Calendar sync and reminders are simulated in this prototype.</p>
      </details>

      <StuckDialog open={stuckOpen} onOpenChange={setStuckOpen} lang={p.lang} onPick={stuck} />
      {cur && <FocusTimer open={focus} onOpenChange={setFocus} title={cur.title} minutes={cur.minutes} onDone={markDone} />}
    </main>
  );
}
