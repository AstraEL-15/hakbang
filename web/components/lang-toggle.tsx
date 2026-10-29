"use client";

import type { Lang } from "@/lib/schemas";
import { cn } from "@/lib/utils";

export function LangToggle({ value, onChange }: { value: Lang; onChange: (l: Lang) => void }) {
  return (
    <div role="radiogroup" aria-label="AI language" className="inline-flex rounded-full border bg-card p-0.5 text-xs font-semibold">
      {(["en", "tl"] as const).map((l) => (
        <button
          key={l}
          role="radio"
          aria-checked={value === l}
          onClick={() => onChange(l)}
          className={cn(
            "rounded-full px-3 py-1.5 transition-colors",
            value === l ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {l === "en" ? "English" : "Taglish"}
        </button>
      ))}
    </div>
  );
}
