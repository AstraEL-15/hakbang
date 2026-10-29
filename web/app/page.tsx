"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { addDoc, collection } from "firebase/firestore";
import { ArrowRight, Camera, Check, FileText, Footprints, Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { LangToggle } from "@/components/lang-toggle";
import { db } from "@/lib/firebase";
import { lastProject, postJson, toDataUrl } from "@/lib/client";
import { dayKey, newId, schedule, totalMinutes } from "@/lib/schedule";
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
  const [minutesPerDay, setMinutesPerDay] = useState(60);
  const [lang, setLang] = useState<Lang>("en");
  const [stages, setStages] = useState<Stage[] | null>(null);
  const [last, setLast] = useState<{ id: string; title: string } | null>(null);
  const busy = stages !== null;

  useEffect(() => setLast(lastProject.get()), []);

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
      const read = await postJson<{ data: Brief; meta: AiMeta }>("/api/read", { image: image ?? undefined, text: text || undefined });
      const n = read.data.deliverables.length;
      set(0, { state: "done", detail: `Found ${n} deliverable${n === 1 ? "" : "s"}: ${read.data.title}`, meta: `${short(read.meta.model)} · ${(read.meta.ms / 1000).toFixed(1)}s` });
      log.push({ label: "Read the brief", detail: `${n} deliverables, ${read.data.requirements.length} requirements`, ms: read.meta.ms, model: read.meta.model });

      const plan = await postJson<{ data: Plan; meta: AiMeta }>("/api/plan", { brief: read.data, deadline: due, minutesPerDay, lang });
      const total = totalMinutes(plan.data.steps);
      set(1, { state: "done", detail: `${plan.data.steps.length} steps · about ${Math.round(total / 6) / 10} hours total`, meta: `${short(plan.meta.model)} · ${(plan.meta.ms / 1000).toFixed(1)}s` });
      log.push({ label: "Broke it into steps", detail: `${plan.data.steps.length} steps, ${total} min`, ms: plan.meta.ms, model: plan.meta.model });

      const sched = schedule(plan.data.steps, due, minutesPerDay);
      set(2, {
        state: "done",
        detail: sched.overMinutes > 0 ? `Across ${sched.daysUsed} days · ${sched.overMinutes} min over your time ⚠️` : `Across ${sched.daysUsed} days, done before the deadline ✓`,
        meta: "Hakbang scheduler",
      });
      log.push({ label: "Scheduled into daily blocks", detail: `${sched.daysUsed} days × ${minutesPerDay} min`, ms: 0 });

      const project: Omit<Project, "id"> = {
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
      lastProject.set({ id: ref.id, title: project.title });
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
        <LangToggle value={lang} onChange={setLang} />
      </header>

      <section className="space-y-2 pt-2">
        <h1 className="text-3xl font-extrabold leading-tight tracking-tight">
          Too big to start?<br />
          <span className="text-primary">Let&apos;s find your one next step.</span>
        </h1>
        <p className="text-muted-foreground">Snap the project brief or syllabus. Hakbang breaks it into tiny steps and fits them into the days you have left.</p>
      </section>

      {last && !busy && (
        <Link href={`/p/${last.id}`} className="flex items-center justify-between rounded-2xl border bg-secondary px-4 py-3 text-sm font-medium text-secondary-foreground">
          <span className="truncate">Continue: {last.title}</span>
          <ArrowRight className="size-4 shrink-0" />
        </Link>
      )}

      {busy ? (
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
          <p className="text-center text-xs text-muted-foreground">
            <Badge variant="secondary" className="mr-1">AI</Badge> reads your task and plans it, and you stay in control.
          </p>
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
