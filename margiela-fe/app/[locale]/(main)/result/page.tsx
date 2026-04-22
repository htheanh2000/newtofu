"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { getState } from "@/lib/store";
import { useTranslations } from "next-intl";

export default function ResultPage() {
  const router = useRouter();
  const t = useTranslations("result");

  useEffect(() => {
    const state = getState();
    if (state.composition?.id) {
      router.replace(`/result/${state.composition.id}`);
    } else {
      router.replace("/");
    }
  }, [router]);

  return (
    <div className="flex-1 flex items-center justify-center bg-white">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="font-title text-[14px] uppercase tracking-widest text-gray-500">
          {t("redirecting")}
        </p>
      </div>
    </div>
  );
}
