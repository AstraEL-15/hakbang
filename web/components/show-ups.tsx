"use client";

import { Check } from "lucide-react";
import { showUps } from "@/lib/pace";
import { cn } from "@/lib/utils";

/** "Days you showed up": a count that never resets, plus this week with one free skip. */
export function ShowUps({ days, className }: { days: string[]; className?: string }) {
  const s = showUps(days);
  return (
    <div className={cn("flex items-center gap-3 rounded-2xl border bg-card px-4 py-3", className)}>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold leading-tight">
          🌱 Showed up {s.total} day{s.total === 1 ? "" : "s"}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {s.total === 0 ? "Finish one step or focus 2 min and today counts." : s.skipUsed ? "Missed a day? Free skip 💤. Nothing resets." : "1 free skip a week. Nothing ever resets."}
        </p>
      </div>
      <ol className="flex gap-1" aria-label="Last 7 days">
        {s.week.map((d) => (
          <li key={d.key} className="flex flex-col items-center gap-0.5" title={{ in: "Showed up", today: "Today: still time", skip: "Free skip", off: "Rest day" }[d.state]}>
            <span
              className={cn(
                "grid size-5 place-items-center rounded-full text-[10px]",
                d.state === "in" && "bg-primary text-primary-foreground",
                d.state === "today" && "border-2 border-dashed border-primary/50",
                d.state === "skip" && "bg-sky-100",
                d.state === "off" && "bg-muted",
              )}
            >
              {d.state === "in" ? <Check className="size-3" /> : d.state === "skip" ? "💤" : null}
            </span>
            <span className="text-[9px] font-medium text-muted-foreground">{d.label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
