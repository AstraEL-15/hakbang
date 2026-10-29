"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { addDoc, collection, onSnapshot, query, where } from "firebase/firestore";
import { ArrowRight, Camera, Check, FileText, Footprints, Loader2, LogOut, Sparkles, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { LangToggle } from "@/components/lang-toggle";
import { useAuth } from "@/components/auth-provider";
import { FocusingNow } from "@/components/body-double";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from "@/lib/firebase";
import { postJson, toDataUrl } from "@/lib/client";
import { dayKey, dayLabel, newId, schedule, totalMinutes } from "@/lib/schedule";
import { phHoliday } from "@/lib/ph-calendar";
import type { AiMeta, Brief, Lang, LogEntry, Plan, Project } from "@/lib/schemas";
import { cn } from "@/lib/utils";

type Stage = { label: string; detail?: string; state: "wait" | "run" | "done"; meta?: string };

const short = (m: string) => (m.includes("gemini") ? "Gemini Flash Lite" : m.includes("deepseek") ? "DeepSeek" : m);

export default function Home() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [showText, setShowText] = useState(false);
  const [deadline, setDeadline] = useState(() => dayKey(Date.now() + 9 * 86_400_000));
  const [minutesPerDay, setMinutesPerDay] = useState(90);
  const [lang, setLang] = useState<Lang>("en");
  const [stages, setStages] = useState<Stage[] | null>(null);
  const { user, google, guest, logout } = useAuth();
  const [plans, setPlans] = useState<Project[]>([]);
  const busy = stages !== null;

  useEffect(() => {
    if (!user) return setPlans([]);
    // Single-field filter (no composite index); sort on the client.
    return onSnapshot(
      query(collection(db, "projects"), where("ownerId", "==", user.uid)),
      (snap) => setPlans(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Project).sort((a, b) => b.createdAt - a.createdAt)),
      () => setPlans([]),
    );
  }, [user]);

  async function pickFile(f?: File) {
    if (!f) return;
    try {
      setImage(await toDataUrl(f));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't open that image.");
    }
  }

  async function trySample() {
    try {
      const blob = await (await fetch("/demo/brief.png")).blob();
      setImage(await toDataUrl(blob));
      setShowText(false);
      setDeadline(dayKey(Date.now() + 9 * 86_400_000));
      toast.success("Sample brief loaded: PSYC 3104 research proposal");
    } catch {
      toast.error("Couldn't load the sample.");
    }
  }

  async function go() {
    if (!user) return toast.error("Please sign in first.");
    if (!image && !text.trim()) return toast.error("Add a photo or paste the task first.");
    const [y, m, d] = deadline.split("-").map(Number);
    const due = new Date(y, m - 1, d, 23, 59).getTime();
    if (due < Date.now()) return toast.error("That deadline already passed. Pick a later date.");

    const s: Stage[] = [
      { label: image ? "Reading your photo" : "Reading your task", state: "run" },
      { label: "Breaking it into small steps", state: "wait" },
      { label: "Fitting steps into your days", state: "wait" },
      { label: "Saving your plan", state: "wait" },
    ];
    const set = (i: number, patch: Partial<Stage>) => {
      s[i] = { ...s[i], ...patch };
      if (patch.state === "done" && s[i + 1]) s[i + 1] = { ...s[i + 1], state: "run" };
      setStages([...s]);
    };
    setStages([...s]);
    const log: LogEntry[] = [];

    try {
      const read = await postJson<{ data: Brief; meta: AiMeta; cached?: boolean }>("/api/read", { image: image ?? undefined, text: text || undefined });
      const n = read.data.deliverables.length;
      set(0, { state: "done", detail: `Found ${n} deliverable${n === 1 ? "" : "s"}: ${read.data.title}`, meta: `${short(read.meta.model)} · ${read.cached ? "cached" : `${(read.meta.ms / 1000).toFixed(1)}s`}` });
      log.push({ label: "Read the brief", detail: `${n} deliverables, ${read.data.requirements.length} requirements`, ms: read.meta.ms, model: read.meta.model });

      const plan = await postJson<{ data: Plan; meta: AiMeta }>("/api/plan", { brief: read.data, deadline: due, minutesPerDay, lang });
      const total = totalMinutes(plan.data.steps);
      set(1, { state: "done", detail: `${plan.data.steps.length} steps · about ${Math.round(total / 6) / 10} hours total`, meta: `${short(plan.meta.model)} · ${(plan.meta.ms / 1000).toFixed(1)}s` });
      log.push({ label: "Broke it into steps", detail: `${plan.data.steps.length} steps, ${total} min`, ms: plan.meta.ms, model: plan.meta.model });

      const sched = schedule(plan.data.steps, due, minutesPerDay);
      const hol = sched.holidays.map((k) => `${dayLabel(k)} (${phHoliday(k)!.label})`).join(", ");
      set(2, {
        state: "done",
        detail:
          (sched.overMinutes > 0
            ? `Across ${sched.daysUsed} days · ${sched.overMinutes} min over your time ⚠️`
            : `Finishes ${dayLabel(sched.finishDay)} · 24-h safety buffer before the deadline ✓`) + (hol ? ` · lighter on ${hol}` : ""),
        meta: "Hakbang scheduler · PH calendar",
      });
      log.push({ label: "Reverse-planned from the deadline", detail: `${sched.daysUsed} days × ${minutesPerDay} min, 24-h buffer${hol ? `, lighter on ${hol}` : ""}`, ms: 0 });

      const project: Omit<Project, "id"> = {
        ownerId: user.uid,
        title: plan.data.title || read.data.title,
        summary: plan.data.summary,
        deadline: due,
        minutesPerDay,
        lang,
        createdAt: Date.now(),
        overMinutes: sched.overMinutes,
        steps: sched.steps.map((st) => ({ id: newId(), title: st.title, detail: st.detail, minutes: st.minutes, energy: st.energy, status: "todo", day: st.day })),
        log,
      };
      const ref = await addDoc(collection(db, "projects"), project);
      set(3, { state: "done", detail: "Opening your first step…" });
      router.push(`/p/${ref.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong. Try again.");
      setStages(null);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 pb-10 pt-5">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-lg">
          <span className="grid size-8 place-items-center rounded-xl bg-primary text-primary-foreground"><Footprints className="size-4.5" /></span>
          Hakbang
        </div>
        <div className="flex items-center gap-2">
          <LangToggle value={lang} onChange={setLang} />
          {user && (
            <button
              aria-label="Sign out"
              title={`Signed in as ${user.isAnonymous ? "guest" : user.displayName ?? user.email}. Tap to sign out.`}
              onClick={() => logout().then(() => toast("Signed out"))}
              className="group relative grid size-8 place-items-center overflow-hidden rounded-full border bg-secondary text-secondary-foreground"
            >
              {user.photoURL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
              ) : (
                <UserRound className="size-4" />
              )}
              <span className="absolute inset-0 hidden place-items-center bg-black/60 text-white group-hover:grid"><LogOut className="size-3.5" /></span>
            </button>
          )}
        </div>
      </header>

      <section className="space-y-2 pt-2">
        <h1 className="text-3xl font-extrabold leading-tight tracking-tight">
          Too big to start?<br />
          <span className="text-primary">Let&apos;s find your one next step.</span>
        </h1>
        <p className="text-muted-foreground">Snap the project brief or syllabus. Hakbang breaks it into tiny steps and fits them into the days you have left.</p>
      </section>

      {user === undefined ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : user === null ? (
        <SignIn onGoogle={google} onGuest={guest} />
      ) : busy ? (
        <Pipeline stages={stages} />
      ) : (
        <>
          <Card className="gap-3 p-4">
            {image ? (
              <div className="relative overflow-hidden rounded-xl border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt="Your brief" className="max-h-56 w-full object-cover object-top" />
                <button aria-label="Remove photo" onClick={() => setImage(null)} className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-black/60 text-white">
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()} className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-primary/30 bg-secondary/50 px-4 py-8 text-center transition-colors hover:bg-secondary">
                <Camera className="size-8 text-primary" />
                <span className="font-semibold">Snap or upload the brief</span>
                <span className="text-xs text-muted-foreground">Photo, screenshot, or syllabus page</span>
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => pickFile(e.target.files?.[0])} />

            <div className="flex gap-2">
              <Button variant="outline" className="h-10 flex-1" onClick={trySample}>
                <Sparkles /> Try a sample brief
              </Button>
              <Button variant="ghost" className="h-10" onClick={() => setShowText((v) => !v)}>
                <FileText /> {showText ? "Hide text" : "Paste text"}
              </Button>
            </div>
            {showText && (
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste the assignment, or just brain-dump what you need to do…"
                className="min-h-28"
              />
            )}
          </Card>

          <Card className="grid grid-cols-2 gap-3 p-4">
            <div className="space-y-1.5">
              <Label htmlFor="deadline">Deadline</Label>
              <input
                id="deadline"
                type="date"
                value={deadline}
                min={dayKey(Date.now())}
                onChange={(e) => setDeadline(e.target.value)}
                className="h-10 w-full rounded-lg border border-input bg-background px-2 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mpd">Time per day</Label>
              <select
                id="mpd"
                value={minutesPerDay}
                onChange={(e) => setMinutesPerDay(Number(e.target.value))}
                className="h-10 w-full rounded-lg border border-input bg-background px-2 text-sm"
              >
                {[30, 45, 60, 90, 120, 180].map((m) => (
                  <option key={m} value={m}>{m < 60 ? `${m} min` : `${m / 60} hr${m > 60 ? "s" : ""}`}</option>
                ))}
              </select>
            </div>
          </Card>

          <Button size="lg" className="h-14 rounded-2xl text-lg font-bold shadow-lg shadow-primary/20" onClick={go} disabled={!image && !text.trim()}>
            Hakbang na! <ArrowRight className="size-5" />
          </Button>
          <FocusingNow />
          <p className="text-center text-xs text-muted-foreground">
            <Badge variant="secondary" className="mr-1">AI</Badge> reads your task and plans it, and you stay in control.
          </p>
          {plans.length > 0 && (
            <section className="space-y-2 pt-2">
              <h2 className="text-sm font-semibold text-muted-foreground">Your plans</h2>
              {plans.slice(0, 3).map((pl) => {
                const done = pl.steps.filter((s) => s.status === "done").length;
                return (
                  <Link key={pl.id} href={`/p/${pl.id}`} className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 text-sm transition-colors hover:bg-secondary">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{pl.title}</p>
                      <p className="text-xs text-muted-foreground">{done}/{pl.steps.length} steps · due {new Date(pl.deadline).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}</p>
                    </div>
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                );
              })}
            </section>
          )}
        </>
      )}
    </main>
  );
}

function Pipeline({ stages }: { stages: Stage[] }) {
  return (
    <Card className="gap-0 p-5" aria-live="polite">
      <p className="mb-4 text-sm font-semibold text-muted-foreground">Hakbang is working on it…</p>
      <ol className="space-y-4">
        {stages.map((st, i) => (
          <li key={i} className={cn("flex gap-3 transition-opacity", st.state === "wait" && "opacity-40")}>
            <span
              className={cn(
                "mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border-2",
                st.state === "done" && "border-primary bg-primary text-primary-foreground",
                st.state === "run" && "border-primary text-primary",
              )}
            >
              {st.state === "done" ? <Check className="size-4" /> : st.state === "run" ? <Loader2 className="size-4 animate-spin" /> : <span className="text-xs">{i + 1}</span>}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{st.label}</p>
              {st.detail && <p className="text-sm text-muted-foreground animate-in fade-in slide-in-from-top-1">{st.detail}</p>}
              {st.meta && <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-primary/80">{st.meta}</p>}
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function SignIn({ onGoogle, onGuest }: { onGoogle: () => Promise<void>; onGuest: () => Promise<void> }) {
  const [busy, setBusy] = useState<"google" | "guest" | null>(null);
  const run = (k: "google" | "guest", fn: () => Promise<void>) => {
    setBusy(k);
    fn().finally(() => setBusy(null));
  };
  return (
    <Card className="gap-3 p-5">
      <p className="font-semibold">Save your plans and pick up on any device</p>
      <Button size="lg" variant="outline" className="h-12 rounded-xl text-base" disabled={!!busy} onClick={() => run("google", onGoogle)}>
        {busy === "google" ? <Loader2 className="animate-spin" /> : <GoogleIcon />} Continue with Google
      </Button>
      <Button size="lg" variant="ghost" className="h-11 rounded-xl" disabled={!!busy} onClick={() => run("guest", onGuest)}>
        {busy === "guest" && <Loader2 className="animate-spin" />} Try as guest
      </Button>
      <p className="text-center text-xs text-muted-foreground">Only you can see your plans.</p>
    </Card>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}
