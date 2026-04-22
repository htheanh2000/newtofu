"use client";

import { Suspense, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useParams, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";

import type { Note } from "@/lib/store";
import { getDeviceHeaders } from "@/lib/device-client";

function ScanSheetLoading() {
  const t = useTranslations("scan");
  return (
    <div className="w-full h-[600px] bg-white flex items-center justify-center">
      <p className="font-title text-[14px] uppercase tracking-widest text-gray-400">
        {t("loadingSheet")}
      </p>
    </div>
  );
}

const MusicSheet = dynamic(() => import("@/components/MusicSheet"), {
  ssr: false,
  loading: () => <ScanSheetLoading />,
});

interface CompositionData {
  id: string;
  instrument: string;
  notes: string;
  duration: number;
  createdAt: string;
}

function ScanPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const isPrintMode = searchParams.get("print") === "true";
  const t = useTranslations("scan");
  const tMusicSheet = useTranslations("musicSheet");
  const locale = (params.locale as string) || "en";

  const [composition, setComposition] = useState<CompositionData | null>(null);
  const [parsedNotes, setParsedNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forcePrintWidth, setForcePrintWidth] = useState(isPrintMode);

  useEffect(() => {
    const fetchComposition = async () => {
      try {
        // Skip device/fingerprint when print=true (Lambda PDF). Read from URL so it's correct on first paint (avoid hydration race).
        const isPrintFromUrl =
          typeof window !== "undefined" && window.location.search.includes("print=true");
        const headers = isPrintFromUrl ? {} : getDeviceHeaders();
        const response = await fetch(`/api/composition/${params.id}`, { headers });
        if (!response.ok) {
          throw new Error("Composition not found");
        }
        const data = await response.json();
        setComposition(data);
        if (data.notes) {
          try {
            const notes = JSON.parse(data.notes);
            setParsedNotes(Array.isArray(notes) ? notes : []);
          } catch {
            setParsedNotes([]);
          }
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : t("failedToLoad")
        );
      } finally {
        setLoading(false);
      }
    };
    if (params.id) {
      fetchComposition();
    }
  }, [params.id, t]);

  const handlePrint = () => {
    setForcePrintWidth(true);
    setTimeout(() => {
      window.print();
      setTimeout(() => setForcePrintWidth(false), 300);
    }, 300);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="font-title text-[14px] uppercase tracking-widest text-gray-500">
            {t("loadingComposition")}
          </p>
        </motion.div>
      </div>
    );
  }

  if (error || !composition) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="w-16 h-16 mx-auto mb-6 rounded-full border-2 border-red-500 flex items-center justify-center">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-red-500"
            >
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="font-title text-[14px] uppercase tracking-[0.15em] mb-4">
            {t("compositionNotFound")}
          </h1>
          <p className="font-body text-[14px] text-gray-500">
            {t("qrInvalid")}
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen flex flex-col ${isPrintMode ? "bg-white" : "bg-gray-100"}`}
    >
      {!isPrintMode && (
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 p-4 print:hidden">
          <div className="max-w-[210mm] mx-auto flex justify-between items-center">
            <span className="font-title text-[14px] uppercase tracking-widest text-gray-500">
              {t("yourScore")}
            </span>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-black text-white font-title text-[14px] uppercase tracking-widest hover:bg-gray-800 transition-colors"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6v-8z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {t("print")}
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 p-4 md:p-8 flex justify-center print:p-0">
        <motion.div
          initial={isPrintMode ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-[210mm] bg-white shadow-lg print:shadow-none print:max-w-none"
          id="print-container"
        >
          <div
            className="p-0 relative flex flex-col print:min-h-[297mm]"
            id="printable-content"
          >
            {/* Design reference overlay (50% opacity) for comparison — hidden in print */}
            <div
              className="absolute inset-0 z-0 opacity-50 bg-cover bg-center bg-no-repeat print:hidden pointer-events-none"
              style={{ backgroundImage: "url(/images/design-reference.png)" }}
              aria-hidden
            />
            <div className="relative z-10 mb-6 overflow-x-auto print:overflow-visible print:flex-1">
              <MusicSheet
                notes={parsedNotes}
                instrument={composition.instrument}
                forcePrintWidth={forcePrintWidth}
                seasonText={tMusicSheet("season")}
                instrumentLabel={tMusicSheet(composition.instrument as "piano" | "violin" | "flute" | "trumpet")}
                locale={locale}
              />
            </div>

            {/* Footer: stitch — fixed sát đáy, dùng style để chắc chắn áp dụng */}
            <footer
              className="footer-stitch fixed left-0 right-0 z-999 flex flex-col items-center justify-center w-full"
              style={{ marginBottom: 20 }}
            >
              <div className="shrink-0 w-[80px] h-[45px]" aria-hidden>
                <svg className="w-full h-full" viewBox="0 0 53 31" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <g clipPath="url(#clip0_181_697)">
                    <path d="M1.91998 0.379981C1.52998 -0.0800194 0.839981 -0.130019 0.379981 0.259981C-0.0800194 0.649981 -0.130019 1.33998 0.259981 1.79998L3.98998 6.15998C4.37998 6.61998 5.06998 6.66998 5.52998 6.27998C5.98998 5.88998 6.03998 5.19998 5.64998 4.73998L1.91998 0.379981Z" fill="#121212"/>
                    <path d="M0.259981 28.73C-0.130019 29.19 -0.0800194 29.88 0.379981 30.27C0.839981 30.66 1.52998 30.61 1.91998 30.15L5.64998 25.79C6.03998 25.33 5.98998 24.64 5.52998 24.25C5.06998 23.86 4.37998 23.91 3.98998 24.37L0.259981 28.73Z" fill="#121212"/>
                    <path d="M46.81 24.25C47.27 23.86 47.96 23.91 48.35 24.37L52.08 28.73C52.47 29.19 52.42 29.88 51.96 30.27C51.5 30.66 50.81 30.61 50.42 30.15L46.69 25.79C46.3 25.33 46.35 24.64 46.81 24.25Z" fill="#121212"/>
                    <path d="M46.69 4.73998C46.3 5.19998 46.35 5.88998 46.81 6.27998C47.27 6.66998 47.96 6.61998 48.35 6.15998L52.08 1.79998C52.47 1.33998 52.42 0.649981 51.96 0.259981C51.5 -0.130019 50.81 -0.0800194 50.42 0.379981L46.69 4.73998Z" fill="#121212"/>
                  </g>
                  <defs>
                    <clipPath id="clip0_181_697">
                      <rect width="52.34" height="30.53" fill="white"/>
                    </clipPath>
                  </defs>
                </svg>
              </div>
            </footer>
          </div>
        </motion.div>
      </div>

      <style jsx global>{`
        @media print {
          .footer-stitch {
            position: fixed !important;
            bottom: 20px !important;
            left: 0 !important;
            right: 0 !important;
          }
          @page {
            size: A4 portrait;
            margin: 15mm;
            margin-bottom: calc(15mm - 50px);
          }
          html,
          body {
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            width: 210mm !important;
            min-width: 210mm !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          .min-h-screen {
            min-height: auto !important;
            width: 100% !important;
          }
          .bg-gray-100 {
            background: white !important;
          }
          .shadow-lg {
            box-shadow: none !important;
          }
          .p-4,
          .md\\:p-8 {
            padding: 0 !important;
          }
          .max-w-\\[210mm\\] {
            max-width: 100% !important;
            width: 180mm !important;
            margin: 0 auto !important;
          }
          svg {
            max-width: 100% !important;
            height: auto !important;
          }
          .p-8,
          .md\\:p-12 {
            padding: 5mm !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>
    </div>
  );
}

function ScanLoadingFallback() {
  const t = useTranslations("kioskProcessing");
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="font-title text-[14px] uppercase tracking-widest text-gray-500">
          {t("loading")}
        </p>
      </div>
    </div>
  );
}

export default function ScanPage() {
  return (
    <Suspense fallback={<ScanLoadingFallback />}>
      <ScanPageContent />
    </Suspense>
  );
}
