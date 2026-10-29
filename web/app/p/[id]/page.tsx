"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { arrayUnion, doc, onSnapshot, updateDoc } from "firebase/firestore";
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
import { BodyDouble } from "@/components/body-double";
import { db } from "@/lib/firebase";
import { postJson } from "@/lib/client";
import { dayKey, dayLabel, newId, planStatus, schedule, totalMinutes } from "@/lib/schedule";
import { DISRUPTIONS, type DisruptionKind, phHoliday } from "@/lib/ph-calendar";
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
  const [focus, setFocus] = useState<number | null>(null); // minutes the timer starts with

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

  function markDone(focusSec = 0) {
    if (!p || !cur) return;
    setFocus(null);
    setCheer(null);
    save({ steps: p.steps.map((s) => (s.id === cur.id ? { ...s, status: "done", focusSec: (s.focusSec ?? 0) + focusSec } : s)) });
    const left = p.steps.length - doneCount - 1;
    toast.success(left ? (p.lang === "tl" ? "Ayan! Isang hakbang na. 🎉" : "Nice! One step down. 🎉") : "That was the last one! 🎉");
  }

  function stopCounts(focusSec: number) {
    if (!p || !cur) return;
    setFocus(null);
    const mins = Math.max(1, Math.round(focusSec / 60));
    save({
      steps: p.steps.map((s) => (s.id === cur.id ? { ...s, focusSec: (s.focusSec ?? 0) + focusSec } : s)),
      log: [...p.log, { label: "Showed up", detail: `${mins} min on "${cur.title}"`, ms: 0 }],
    });
    toast.success(p.lang === "tl" ? "Nagpakita ka. Panalo na 'yun. 💚" : "You showed up. That counts. 💚");
  }

  /** Re-run the reverse scheduler on the remaining steps, from today, honouring disruptions. */
  function replan(extra?: { day: string; kind: DisruptionKind }) {
    if (!p) return;
    const list = [...(p.disruptions ?? []), ...(extra ? [extra] : [])];
    const blocked = Object.fromEntries(list.map((d) => [d.day, DISRUPTIONS[d.kind].factor]));
    const todo = p.steps.filter((s) => s.status === "todo");
    const res = schedule(todo, p.deadline, p.minutesPerDay, { blocked });
    const newDay = new Map(res.steps.map((s) => [s.id, s.day]));
    const moved = todo.filter((s) => newDay.get(s.id) !== s.day).length;
    const why = extra ? `${DISRUPTIONS[extra.kind].emoji} ${DISRUPTIONS[extra.kind].label} today` : "Re-planned from today";
    save({
      steps: p.steps.map((s) => (s.status === "todo" ? { ...s, day: newDay.get(s.id) ?? s.day } : s)),
      disruptions: list,
      overMinutes: res.overMinutes,
      log: [...p.log, { label: extra ? "Auto-rescheduled around a disruption" : "Re-planned from today", detail: `${why}: moved ${moved} step${moved === 1 ? "" : "s"}, finishes ${dayLabel(res.finishDay)}`, ms: 0 }],
    });
    toast.success(
      `${why}: moved ${moved} step${moved === 1 ? "" : "s"}. ` +
        (res.overMinutes > 0 ? `It's ${fmtMin(res.overMinutes)} tight now; a little extra time per day fixes it.` : `Still done by ${dayLabel(res.finishDay)}, before your buffer ✓`),
      { duration: 6000 },
    );
  }

  function park(thought: string) {
    updateDoc(doc(db, "projects", id), { parked: arrayUnion(thought) }).catch(() => toast.error("Couldn't park that thought."));
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
  const st = planStatus(p.steps);
  const todayKey = dayKey(today);
  const todayDisruption = p.disruptions?.find((d) => d.day === todayKey);
  const timeFrac = Math.max(0, Math.min(1, (p.deadline - Date.now()) / Math.max(1, p.deadline - p.createdAt)));

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
        <Bar label="Steps done" frac={doneCount / p.steps.length} right={`${doneCount}/${p.steps.length}`} className="bg-primary" />
        <Bar label="Time left" frac={timeFrac} right={`${daysLeft}d`} className="bg-amber-400" />
        {cur && st.behind > 0 ? (
          <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <span className="flex-1">🌱 {st.behind} step{st.behind === 1 ? "" : "s"} waiting from earlier days. No stress, it happens.</span>
            <Button size="sm" variant="outline" className="shrink-0 bg-white" onClick={() => replan()}>Re-plan from today</Button>
          </div>
        ) : cur && p.overMinutes > 0 ? (
          <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            This plan is ~{fmtMin(p.overMinutes)} tight for your daily time. A little extra time per day keeps it comfy.
          </p>
        ) : cur && st.finishDay ? (
          <p className="rounded-xl bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground">
            ✓ On track · finishes {dayLabel(st.finishDay)}, with a 24-h safety buffer before the deadline
          </p>
        ) : null}
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
            <Button size="lg" className="h-13 rounded-2xl text-base font-bold" onClick={() => setFocus(2)}>
              <Play /> Start · just 2 min
            </Button>
            {cur.minutes > 2 && (
              <button className="-mt-1 text-xs font-medium text-muted-foreground underline-offset-2 hover:underline" onClick={() => setFocus(Math.min(25, cur.minutes))}>
                or focus for {Math.min(25, cur.minutes)} min
              </button>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="lg" className="h-12 rounded-2xl" onClick={() => markDone()}>
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

      {cur && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">Something came up today?</h3>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(DISRUPTIONS) as DisruptionKind[]).map((k) => (
              <button
                key={k}
                disabled={!!todayDisruption}
                onClick={() => replan({ day: todayKey, kind: k })}
                className={cn(
                  "rounded-full border bg-card px-3 py-2 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-50",
                  todayDisruption?.kind === k && "border-primary bg-secondary opacity-100 disabled:opacity-100",
                )}
              >
                {DISRUPTIONS[k].emoji} {DISRUPTIONS[k].label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">One tap and Hakbang re-plans around it. Automatic PAGASA / class-suspension alerts are simulated in this prototype.</p>
        </section>
      )}

      <section className="space-y-3">
        <h3 className="flex items-center gap-2 font-bold"><CalendarDays className="size-4 text-primary" /> Your schedule</h3>
        {days.map(([day, steps]) => (
          <Card key={day} className="gap-2 p-4">
            <div className="flex items-baseline justify-between">
              <span className="font-semibold">{dayLabel(day)}</span>
              <span className="text-xs text-muted-foreground">{fmtMin(totalMinutes(steps))} of {fmtMin(p.minutesPerDay)}</span>
            </div>
            <DayBadges day={day} disruption={p.disruptions?.find((d) => d.day === day)?.kind} />
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

      {!!p.parked?.length && (
        <details className="rounded-2xl border bg-card p-4 text-sm">
          <summary className="cursor-pointer font-semibold">💭 Parking lot ({p.parked.length})</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            {p.parked.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => save({ parked: [] })}>Clear parked thoughts</Button>
        </details>
      )}

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
      {cur && (
        <FocusTimer
          open={focus !== null}
          onOpenChange={(o) => !o && setFocus(null)}
          title={cur.title}
          startMinutes={focus ?? 2}
          onDone={markDone}
          onStop={stopCounts}
          onPark={park}
        >
          {focus !== null && <BodyDouble />}
        </FocusTimer>
      )}
    </main>
  );
}

function Bar({ label, frac, right, className }: { label: string; frac: number; right: string; className: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 shrink-0 text-xs font-medium text-muted-foreground">{label}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-secondary">
        <div className={cn("h-full rounded-full transition-all duration-700", className)} style={{ width: `${frac * 100}%` }} />
      </div>
      <span className="w-9 text-right text-xs font-semibold tabular-nums text-muted-foreground">{right}</span>
    </div>
  );
}

function DayBadges({ day, disruption }: { day: string; disruption?: DisruptionKind }) {
  const hol = phHoliday(day);
  if (!hol && !disruption) return null;
  return (
    <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
      {hol && <span className="rounded-full bg-sky-50 px-2 py-0.5 text-sky-800">🇵🇭 {hol.label} · lighter day</span>}
      {disruption && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-900">{DISRUPTIONS[disruption].emoji} {DISRUPTIONS[disruption].label}</span>}
    </div>
  );
}
