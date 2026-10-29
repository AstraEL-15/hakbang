"use client";

import { Button } from "@/components/ui/button";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-4xl">🌱</p>
      <h1 className="text-xl font-semibold">Something tripped, but your plan is safe.</h1>
      <p className="text-muted-foreground">Take a breath, then try again.</p>
      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" onClick={() => (window.location.href = "/")}>Go home</Button>
      </div>
    </main>
  );
}
