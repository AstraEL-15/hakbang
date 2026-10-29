"use client";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { Lang, StuckReason } from "@/lib/schemas";

const REASONS: { id: StuckReason; emoji: string; en: string; tl: string; hint: string }[] = [
  { id: "too_big", emoji: "🏔️", en: "It's too big", tl: "Ang laki masyado", hint: "Make it smaller" },
  { id: "confused", emoji: "🤔", en: "I don't get it", tl: "Hindi ko gets", hint: "Explain + show an example" },
  { id: "scared", emoji: "😰", en: "Scared it'll be bad", tl: "Baka pangit gawa ko", hint: "Ugly first draft mode" },
  { id: "boring", emoji: "😴", en: "It's boring", tl: "Nakakabagot", hint: "Turn it into a game" },
  { id: "distracted", emoji: "🦋", en: "I'm distracted", tl: "Distracted ako", hint: "Quick reset first" },
];

export function StuckDialog({
  open,
  onOpenChange,
  lang,
  onPick,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  lang: Lang;
  onPick: (r: StuckReason) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-3 p-5 sm:max-w-sm">
        <DialogTitle className="text-lg font-bold">{lang === "tl" ? "Anong klaseng stuck?" : "What kind of stuck?"}</DialogTitle>
        <DialogDescription>{lang === "tl" ? "Walang mali na sagot. Iba-iba ang tulong para sa bawat isa." : "No wrong answer. Each one gets a different kind of help."}</DialogDescription>
        <div className="grid gap-2">
          {REASONS.map((r) => (
            <button
              key={r.id}
              onClick={() => onPick(r.id)}
              className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-secondary"
            >
              <span className="text-2xl" aria-hidden>{r.emoji}</span>
              <span className="flex-1">
                <span className="block font-semibold">{lang === "tl" ? r.tl : r.en}</span>
                <span className="block text-xs text-muted-foreground">{r.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
