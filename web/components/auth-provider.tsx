"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { GoogleAuthProvider, onAuthStateChanged, signInAnonymously, signInWithPopup, signOut, type User } from "firebase/auth";
import { toast } from "sonner";
import { auth } from "@/lib/firebase";

type Ctx = {
  user: User | null | undefined; // undefined = still restoring the session
  google: () => Promise<void>;
  guest: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthCtx = createContext<Ctx | null>(null);

function authError(e: unknown) {
  const code = (e as { code?: string })?.code ?? "";
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return;
  if (code === "auth/popup-blocked") return toast.error("Your browser blocked the sign-in popup. Allow popups and try again.");
  if (code === "auth/unauthorized-domain") return toast.error("This site isn't allowed to sign in yet (Firebase authorized domains).");
  if (code === "auth/admin-restricted-operation" || code === "auth/operation-not-allowed") return toast.error("That sign-in method isn't enabled yet.");
  toast.error("Couldn't sign in. Check the connection and try again.");
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => onAuthStateChanged(auth, setUser), []);

  const value: Ctx = {
    user,
    google: () => signInWithPopup(auth, new GoogleAuthProvider()).then(() => undefined, (e) => void authError(e)),
    guest: () => signInAnonymously(auth).then(() => undefined, (e) => void authError(e)),
    logout: () => signOut(auth),
  };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
