"use client";

import { motion } from "framer-motion";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

export default function KioskCompletePage() {
  const router = useRouter();
  const t = useTranslations("kioskComplete");

  const handleStartOver = () => {
    router.push("/kiosk");
  };

  return (
    <div className="flex-1 bg-white flex flex-col items-center justify-center p-8">
      <motion.div
        className="text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.3 }}
      >
        <p className="font-body text-[16px] text-gray-600 mb-2">
          {t("message")}
        </p>
        <h1 className="font-title text-[32px] uppercase tracking-[0.1em] mb-12">
          {t("thankYou")}
        </h1>

        <motion.div
          className="w-16 h-16 mx-auto mb-12 rounded-full border-2 border-black flex items-center justify-center"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5, delay: 0.6, type: "spring" }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              d="M5 12l5 5L20 7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </motion.div>

        <motion.button
          onClick={handleStartOver}
          className="font-title text-[14px] uppercase tracking-[0.1em] text-gray-500 underline underline-offset-4 hover:text-black transition-colors"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.9 }}
        >
          {t("startOver")}
        </motion.button>
      </motion.div>
    </div>
  );
}
