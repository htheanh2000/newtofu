"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CompositionsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/users/");
  }, [router]);
  return (
    <div className="flex items-center justify-center p-8 text-neutral-500">
      Redirecting…
    </div>
  );
}
