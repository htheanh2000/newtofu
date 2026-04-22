"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { Link as IntlLink } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";

export default function LandingPage() {
  const t = useTranslations("home");
  const tCommon = useTranslations("common");

  return (
    <div className="flex-1 flex flex-col bg-white">
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center w-full max-w-[300px] ">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <Image
              src="/images/logo-full.svg"
              alt={tCommon("logoFullAlt")}
              width={175}
              height={37}
              className="object-contain w-[174px] h-auto"
              unoptimized
              style={{ imageRendering: "auto" }}
            />
          </motion.div>

          <motion.div
            className="text-center w-full mt-[84px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <h1
              className="font-title text-[16px] font-bold uppercase leading-normal text-black text-center tracking-[1.6px]"
              style={{ fontFamily: "var(--font-title)" }}
            >
              {t("titleLine1")}
            </h1>

            <div className="h-[48px]" />

            <div
              className="font-body text-[14px] leading-[20px] text-black text-center max-w-[300px] mx-auto flex flex-col gap-[20px]"
              style={{ fontFamily: "var(--font-body)", letterSpacing: 0 }}
            >
              <p className="mb-0">{t("subtitleLine1")}</p>
              <p className="mb-0">{t("subtitleLine2")}</p>
            </div>
          </motion.div>

          <div className="h-[72px]" />

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="flex flex-col items-center"
          >
            <IntlLink href="/choose-medium">
              <button
                className="font-title bg-black text-white w-[240px] h-[36px] text-[16px] font-bold uppercase tracking-[1.6px] hover:opacity-90 transition-opacity flex items-center justify-center px-6"
                style={{ fontFamily: "var(--font-title)" }}
              >
                {t("cta")}
              </button>
            </IntlLink>
            <LocaleSwitcher className="font-title text-[14px] uppercase tracking-[1.3px] mt-[100px]" />
          </motion.div>
        </div>
      </div>
    </div>
  );
}
