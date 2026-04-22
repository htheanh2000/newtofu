"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "@/lib/neon-client";
import LoginForm from "@/components/LoginForm";

export default function HomePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    getSession()
      .then((session) => {
        setHasSession(!!session);
        setReady(true);
      })
      .catch(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (hasSession) {
      router.replace("/users/");
    }
  }, [ready, hasSession, router]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="text-neutral-500">Loading…</span>
      </div>
    );
  }

  if (hasSession) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-neutral-900 mb-4">Account</h1>
        <LoginForm onSuccess={() => router.replace("/users/")} />
      </div>
    </div>
  );
}
