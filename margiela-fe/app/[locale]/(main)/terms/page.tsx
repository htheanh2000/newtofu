"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { getState } from "@/lib/store";
import { MixedLangText } from "@/components/MixedLangText";

type ConsentModal = "marketing" | "profiling" | null;

export default function TermsPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("privacy");
  const [marketingConsent, setMarketingConsent] = useState<"yes" | "no" | "">("yes");
  const [profilingConsent, setProfilingConsent] = useState<"yes" | "no" | "">("yes");
  const [modal, setModal] = useState<ConsentModal>(null);
  const [modalContent, setModalContent] = useState<string>("");
  const [modalLoading, setModalLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [consentError, setConsentError] = useState("");

  const loadModalContent = useCallback(
    async (type: "marketing" | "profiling") => {
      setModalLoading(true);
      setModalContent("");
      try {
        const path =
          type === "marketing"
            ? `/legal/mm-information-notice-${locale}.txt`
            : `/legal/mm-profiling-purposes-${locale}.txt`;
        const res = await fetch(path);
        const text = await res.text();
        setModalContent(text);
      } catch {
        setModalContent(t("loadError"));
      } finally {
        setModalLoading(false);
      }
    },
    [locale, t]
  );

  useEffect(() => {
    if (modal) {
      loadModalContent(modal);
    }
  }, [modal, loadModalContent]);

  useEffect(() => {
    const state = getState();
    if (!state.userInfo) {
      router.replace("/identification");
      return;
    }
    if (!state.composition?.id) {
      router.replace("/");
    }
  }, [router]);

  const openModal = (type: ConsentModal) => {
    setModal(type);
  };

  const closeModal = () => {
    setModal(null);
    setModalContent("");
  };

  const canProceed = marketingConsent === "yes" && profilingConsent === "yes";

  const handleReceiveScore = async () => {
    setConsentError("");
    if (!canProceed) {
      setConsentError(t("validationConsent"));
      return;
    }

    const state = getState();
    if (!state.composition || !state.userInfo) {
      router.replace("/identification");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          composition: state.composition,
          userInfo: state.userInfo,
        }),
      });
      if (!response.ok) {
        throw new Error("Submit failed");
      }
      if (state.composition.id) {
        router.push(`/result/${state.composition.id}`);
      } else {
        router.push("/");
      }
    } catch {
      setConsentError(t("submitError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const isZh = locale === "zh";

  return (
    <div className="h-full min-h-0 flex flex-col bg-white">
      <div className="flex-1 min-h-0 overflow-auto flex flex-col items-center px-5 pt-[24px] pb-12">
        <div className="flex flex-col gap-[32px] items-center w-full max-w-[300px]">
          <h1
            className={
              isZh
                ? "font-body text-[16px] font-bold tracking-[0.02em] text-black text-center w-full"
                : "font-title text-[15px] font-semibold tracking-[1.5px] text-black uppercase text-center w-full"
            }
          >
            {t("title")}
          </h1>

          <div className="flex flex-col gap-[32px] w-full">
            {/* Marketing */}
            <section className="flex flex-col gap-[24px] items-start w-full">
              <p
                className={
                  isZh
                    ? "font-body text-[14px] text-black leading-[20px] tracking-[1.2px] w-full whitespace-pre-line"
                    : "font-body text-[14px] text-black leading-[1.15] w-full"
                }
              >
                <MixedLangText text={t("marketingIntro")} locale={locale} />
              </p>
              <p className="font-body text-[14px] text-black w-full">
                {t("linkMarketingPrefix")}
                <button
                  type="button"
                  onClick={() => openModal("marketing")}
                  className="underline focus:outline-none"
                >
                  {t("linkMarketing")}
                </button>
              </p>
              <div className="flex flex-col gap-[12px]">
                <p className="font-body text-[14px] text-black">{t("requiredField")}</p>
                <div className="flex gap-[24px]">
                  <label className="flex items-center gap-[6px] cursor-pointer">
                    <input
                      type="radio"
                      name="marketing"
                      checked={marketingConsent === "yes"}
                      onChange={() => setMarketingConsent("yes")}
                      className="w-5 h-5 border border-gray-400 accent-black shrink-0"
                    />
                    <span
                      className={
                        isZh
                          ? "font-body text-[14px] leading-[20px] text-black"
                          : "font-body text-[14px] leading-[1.15] text-black"
                      }
                    >
                      {t("yes")}
                    </span>
                  </label>
                  <label className="flex items-center gap-[6px] cursor-pointer">
                    <input
                      type="radio"
                      name="marketing"
                      checked={marketingConsent === "no"}
                      onChange={() => setMarketingConsent("no")}
                      className="w-5 h-5 border border-gray-400 accent-black shrink-0"
                    />
                    <span
                      className={
                        isZh
                          ? "font-body text-[14px] leading-[20px] text-black"
                          : "font-body text-[14px] leading-[1.15] text-black"
                      }
                    >
                      {t("no")}
                    </span>
                  </label>
                </div>
              </div>
            </section>

            {/* Profiling */}
            <section className="flex flex-col gap-[24px] items-start w-full">
              <p
                className={
                  isZh
                    ? "font-body text-[14px] text-black leading-[20px] tracking-[1.2px] w-full whitespace-pre-line"
                    : "font-body text-[14px] text-black leading-[1.15] w-full"
                }
              >
                <MixedLangText text={t("profilingIntro")} locale={locale} />
              </p>
              <p className="font-body text-[14px] text-black w-full whitespace-pre-wrap">
                {t("linkProfilingPrefix")}
                <button
                  type="button"
                  onClick={() => openModal("profiling")}
                  className="underline focus:outline-none"
                >
                  {t("linkProfiling")}
                </button>
              </p>
              <div className="flex flex-col gap-[12px]">
                <p className="font-body text-[14px] text-black">{t("requiredField")}</p>
                <div className="flex gap-[24px]">
                  <label className="flex items-center gap-[6px] cursor-pointer">
                    <input
                      type="radio"
                      name="profiling"
                      checked={profilingConsent === "yes"}
                      onChange={() => setProfilingConsent("yes")}
                      className="w-5 h-5 border border-gray-400 accent-black shrink-0"
                    />
                    <span
                      className={
                        isZh
                          ? "font-body text-[14px] leading-[20px] text-black"
                          : "font-body text-[14px] leading-[1.15] text-black"
                      }
                    >
                      {t("yes")}
                    </span>
                  </label>
                  <label className="flex items-center gap-[6px] cursor-pointer">
                    <input
                      type="radio"
                      name="profiling"
                      checked={profilingConsent === "no"}
                      onChange={() => setProfilingConsent("no")}
                      className="w-5 h-5 border border-gray-400 accent-black shrink-0"
                    />
                    <span
                      className={
                        isZh
                          ? "font-body text-[14px] leading-[20px] text-black"
                          : "font-body text-[14px] leading-[1.15] text-black"
                      }
                    >
                      {t("no")}
                    </span>
                  </label>
                </div>
              </div>
            </section>
          </div>

          {!canProceed && (
            <p className="font-body text-[14px] text-red-500 text-center">
              {t("acceptPrivacyTerms")}
            </p>
          )}
          {consentError && canProceed && (
            <p className="font-body text-[14px] text-red-500 text-center">
              {consentError}
            </p>
          )}

          <button
            type="button"
            disabled={!canProceed || isSubmitting}
            onClick={handleReceiveScore}
            className={
              "w-[240px] h-[36px] mt-[16px] mb-[100px] bg-black text-white font-title uppercase tracking-[1.5px] hover:opacity-90 transition-opacity flex items-center justify-center disabled:opacity-50 " +
              (isZh ? "text-[16px] font-bold" : "text-[15px] font-semibold")
            }
          >
            {isSubmitting ? "..." : t("receiveScore")}
          </button>
        </div>
      </div>

      {/* Modal for legal content */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={closeModal}
          role="dialog"
          aria-modal="true"
          aria-label="Legal notice"
        >
          <div
            className="bg-white max-w-[90vw] max-h-[85vh] w-full overflow-hidden flex flex-col rounded shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-end p-3 border-b border-gray-200">
              <button
                type="button"
                onClick={closeModal}
                className="font-title text-[14px] font-bold uppercase tracking-wider hover:underline focus:outline-none"
              >
                {t("close")}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {modalLoading ? (
                <p className="font-body text-[14px] text-gray-500">{t("loading")}</p>
              ) : modal === "marketing" && modalContent.includes("\n") ? (
                <div className="font-body text-[14px] leading-relaxed text-black">
                  <p className="font-bold mb-3">{modalContent.split("\n")[0]}</p>
                  <pre className="whitespace-pre-wrap font-body">
                    {modalContent.split("\n").slice(1).join("\n")}
                  </pre>
                </div>
              ) : (
                <pre className="font-body text-[14px] leading-relaxed whitespace-pre-wrap text-black">
                  {modalContent}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
