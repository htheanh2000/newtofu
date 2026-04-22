"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useParams } from "next/navigation";
import QRCode from "qrcode";
import { useLocale, useTranslations } from "next-intl";
import { MixedLangText } from "@/components/MixedLangText";
import { getDeviceHeaders } from "@/lib/device-client";

export default function ResultPage() {
  const params = useParams();
  const locale = useLocale();
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [pdfUrl, setPdfUrl] = useState<string>("");
  const [status, setStatus] = useState<"generating" | "ready" | "error">("generating");
  const [phase, setPhase] = useState<"pdf" | "qr">("pdf");
  const [errorMessage, setErrorMessage] = useState("");
  const t = useTranslations("resultId");
  const isEn = locale === "en";

  useEffect(() => {
    const generatePdfAndQrCode = async () => {
      try {
        const compositionId = params.id as string;
        setPhase("pdf");
        const deviceHeaders = getDeviceHeaders();
        const response = await fetch(`/api/generate-pdf/${compositionId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...deviceHeaders },
          body: JSON.stringify({ locale }),
        });

        if (!response.ok) {
          throw new Error("Failed to generate PDF");
        }

        const result = await response.json();
        const generatedPdfUrl = result?.pdfUrl ?? "";
        setPdfUrl(generatedPdfUrl);

        setPhase("qr");
        const viewPageUrl =
          typeof window !== "undefined"
            ? `${window.location.origin}/${locale}/view/${compositionId}`
            : "";
        const qrUrl = await QRCode.toDataURL(viewPageUrl, {
          width: 210,
          margin: 2,
          color: { dark: "#000000", light: "#ffffff" },
        });
        setQrCodeUrl(qrUrl);
        setStatus("ready");
      } catch (err) {
        console.error("Error:", err);
        setErrorMessage(t("errorMessage"));
        setStatus("error");
      }
    };

    if (params.id) {
      generatePdfAndQrCode();
    }
  }, [params.id]);

  if (status === "generating") {
    return (
      <div className="flex-1 flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-black border-t-transparent rounded-full animate-spin mx-auto mb-6" />
          <p className="font-title text-[14px] uppercase tracking-widest text-black animate-pulse">
            {phase === "pdf" ? t("generating") : t("creatingQr")}
          </p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex-1 flex items-center justify-center bg-white p-8">
        <div className="text-center">
          <h1 className="font-title text-[14px] uppercase tracking-[0.15em] mb-4">
            {t("somethingWrong")}
          </h1>
          <p className="font-body text-[14px] text-gray-500">{errorMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white">
      <div className="flex-1 flex flex-col items-center overflow-auto px-5 pt-[24px] pb-6">
        <div className="w-full max-w-[300px] flex flex-col items-center gap-[32px]">
          <div className="flex flex-col items-center gap-[32px] w-full">
            <motion.h1
              className={`font-title text-black text-center w-full whitespace-pre-line ${
                isEn ? "text-[15px] font-semibold tracking-[1.5px] leading-none" : "text-[16px] font-bold tracking-[1.6px] leading-none"
              }`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              {t("scoreReady")}
            </motion.h1>

            <motion.p
              className={`font-body text-[14px] text-black text-center w-full whitespace-pre-line ${
                isEn ? "leading-[1.15]" : "leading-[20px] tracking-[1.2px]"
              }`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <MixedLangText text={t("presentDescription")} locale={locale} />
            </motion.p>

            <motion.div
              className={`font-body text-[14px] text-black text-center w-full whitespace-pre-line ${
                isEn ? "leading-[1.15]" : "leading-[20px] tracking-[1.2px]"
              }`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <MixedLangText text={`${t("storeLocation")}\n${t("storeAddress")}`} locale={locale} />
            </motion.div>
          </div>

          <motion.div
            className="shrink-0 w-[210px] h-[210px] flex justify-center items-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <div
              className="w-full h-full bg-white flex items-center justify-center overflow-hidden select-none pointer-events-none"
              aria-label="QR code for in-store scan only"
            >
              {qrCodeUrl ? (
                <img
                  src={qrCodeUrl}
                  alt="QR Code for shop scan"
                  className="w-full h-full object-contain"
                  draggable={false}
                />
              ) : (
                <div className="w-full h-full bg-gray-100 animate-pulse" />
              )}
            </div>
          </motion.div>
        </div>

        <motion.p
          className={`font-body text-[14px] text-black text-center mt-[120px] ${
            isEn ? "leading-[1.15]" : "leading-[20px] tracking-[1.2px]"
          }`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          {t("doNotRefresh")}
        </motion.p>
      </div>
    </div>
  );
}
