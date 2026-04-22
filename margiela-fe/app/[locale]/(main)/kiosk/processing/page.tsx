"use client";

import { useEffect, useState, Suspense } from "react";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

function ProcessingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const [status, setStatus] = useState<"receiving" | "rendering" | "printing">(
    "receiving"
  );
  const t = useTranslations("kioskProcessing");

  useEffect(() => {
    const timer1 = setTimeout(() => setStatus("rendering"), 2000);
    const timer2 = setTimeout(() => setStatus("printing"), 4000);
    const timer3 = setTimeout(() => router.push("/kiosk/complete"), 6000);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [router]);

  return (
    <div className="flex-1 bg-white flex flex-col items-center justify-center p-8">
      <motion.div
        className="text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <p className="font-body text-[16px] text-gray-600 mb-2">
          {status === "receiving" && t("receiving")}
          {status === "rendering" && t("rendering")}
          {status === "printing" && t("printing")}
        </p>

        {status === "rendering" && (
          <motion.h1
            className="font-title text-[24px] uppercase tracking-[0.1em]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {t("rendering")}
          </motion.h1>
        )}

        <div className="flex justify-center gap-2 mt-8">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2 h-2 bg-black rounded-full"
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: i * 0.2,
              }}
            />
          ))}
        </div>
      </motion.div>

      {code && (
        <motion.p
          className="absolute bottom-8 font-title text-[14px] uppercase tracking-wider text-gray-400"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          {t("processing", { code: code.slice(0, 20) })}
        </motion.p>
      )}
    </div>
  );
}

export default function KioskProcessingPage() {
  const t = useTranslations("kioskProcessing");

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="animate-pulse">{t("loading")}</div>
        </div>
      }
    >
      <ProcessingContent />
    </Suspense>
  );
}
