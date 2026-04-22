"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

export default function KioskPage() {
  const router = useRouter();
  const [scanCode, setScanCode] = useState("");
  const [error, setError] = useState("");
  const t = useTranslations("kiosk");

  const handleScan = async () => {
    if (!scanCode.trim()) {
      setError(t("errorEnterCode"));
      return;
    }
    setError("");
    router.push(`/kiosk/processing?code=${encodeURIComponent(scanCode)}`);
  };

  return (
    <div className="flex-1 bg-white flex flex-col items-center justify-center p-8">
      <motion.div
        className="text-center max-w-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.3 }}
      >
        <div className="w-[200px] h-[284px] mx-auto mb-8 bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col items-center justify-center p-6">
          <div className="w-full h-32 bg-gray-100 rounded mb-4 flex items-center justify-center">
            <span className="font-title text-[14px] uppercase tracking-wider text-gray-400">
              {t("scorePreview")}
            </span>
          </div>
          <div className="w-[100px] h-[100px] border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              className="text-gray-400"
            >
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
            </svg>
          </div>
        </div>

        <p className="font-body text-[14px] text-gray-600 mb-8">
          {t("scanInstruction")}
        </p>

        <div className="flex flex-col gap-4">
          <input
            type="text"
            value={scanCode}
            onChange={(e) => setScanCode(e.target.value)}
            placeholder={t("enterCodePlaceholder")}
            className="px-4 py-3 border border-gray-300 rounded-lg font-body text-center focus:border-black focus:outline-none"
          />
          {error && (
            <p className="font-title text-[14px] text-red-500">{error}</p>
          )}
          <button
            onClick={handleScan}
            className="px-8 py-3 bg-black text-white font-title text-[14px] uppercase tracking-wider rounded-full hover:opacity-85 transition-opacity"
          >
            {t("printScore")}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
