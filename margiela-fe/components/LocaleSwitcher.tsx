"use client";

import { usePathname } from "@/i18n/navigation";
import { useLocale } from "next-intl";

export function LocaleSwitcher({ className }: { className?: string }) {
  const pathname = usePathname();
  const locale = useLocale();

  const currentPath = pathname?.startsWith("/") ? pathname : `/${pathname || ""}`;
  const pathWithoutLeadingSlash = (currentPath || "/").replace(/^\//, "");

  const handleLocaleChange = (newLocale: "en" | "zh") => {
    const newPath = pathWithoutLeadingSlash ? `/${newLocale}/${pathWithoutLeadingSlash}` : `/${newLocale}`;
    window.location.href = newPath;
  };

  return (
    <div className={`flex items-center justify-center gap-4 ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => handleLocaleChange("en")}
        className={`font-title text-[14px] uppercase tracking-[1.3px] transition-colors ${
          locale === "en"
            ? "text-black border-b border-black pb-0.5 font-normal"
            : "text-gray-500 hover:text-black font-light"
        }`}
      >
        ENGLISH
      </button>
      <span className="text-black text-[14px] font-light" aria-hidden>
        |
      </span>
      <button
        type="button"
        onClick={() => handleLocaleChange("zh")}
        className={`font-body text-[14px] font-light transition-colors ${
          locale === "zh"
            ? "text-black border-b border-black pb-0.5"
            : "text-gray-500 hover:text-black"
        }`}
        style={{ fontFamily: "var(--font-body)" }}
      >
        繁體中文
      </button>
    </div>
  );
}
