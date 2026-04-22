"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { DEVICE_STORAGE_KEY } from "@/lib/device-client";

export default function RegisterDevicePage() {
  const t = useTranslations("registerDevice");
  const locale = useLocale();
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [deviceId, setDeviceId] = useState<string>("");

  useEffect(() => {
    const run = async () => {
      try {
        const existing = (() => {
          try { return localStorage.getItem(DEVICE_STORAGE_KEY); } catch { return null; }
        })();

        const res = await fetch("/api/device/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceId: existing || undefined }),
        });

        if (!res.ok) {
          setStatus("error");
          return;
        }

        const data = await res.json();
        const id = data?.deviceId != null ? String(data.deviceId) : "";

        if (id) {
          try { localStorage.setItem(DEVICE_STORAGE_KEY, id); } catch { /* Safari private */ }
          setDeviceId(id);
          setStatus("success");
        } else {
          setStatus("error");
        }
      } catch {
        setStatus("error");
      }
    };
    run();
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-white items-center justify-center px-6">
      {status === "loading" && (
        <div className="flex flex-col items-center gap-5">
          <div className="w-10 h-10 border-2 border-black border-t-transparent rounded-full animate-spin" />
          <p className="font-body text-[14px] text-black/70 tracking-wide">
            {t("loading")}
          </p>
        </div>
      )}

      {status === "error" && (
        <div className="flex flex-col items-center gap-5 max-w-[340px] text-center">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#dc2626"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <p className="font-body text-[14px] text-red-600 leading-relaxed">
            Registration failed. Please close this page and scan the QR code
            again.
          </p>
        </div>
      )}

      {status === "success" && (
        <div className="flex flex-col items-center gap-6 max-w-[340px] text-center animate-[fadeIn_0.4s_ease-out]">
          <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#16a34a"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          <h1
            className={
              locale === "zh"
                ? "font-body text-[18px] font-bold tracking-[0.02em] text-black"
                : "font-title text-[16px] font-semibold tracking-[2px] text-black uppercase"
            }
          >
            {t("title")}
          </h1>

          <p className="font-body text-[14px] text-black/80 leading-relaxed">
            {t("success")}
          </p>

          <div className="w-full mt-2 bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-3">
            <p className="font-body text-[11px] text-black/50 uppercase tracking-wider mb-1.5">
              {t("deviceId")}
            </p>
            <p className="font-mono text-[13px] text-black break-all select-all leading-snug">
              {deviceId}
            </p>
          </div>

          <p className="font-body text-[12px] text-black/40 mt-2 leading-relaxed">
            You can now close this page and scan any music sheet QR code.
          </p>
        </div>
      )}
    </div>
  );
}
