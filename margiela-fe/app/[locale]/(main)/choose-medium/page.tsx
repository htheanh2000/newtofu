"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { useRouter } from "@/i18n/navigation";
import { setState, generateId } from "@/lib/store";
import { useTranslations } from "next-intl";

type Instrument = "piano" | "violin" | "flute" | "trumpet";

const INSTRUMENT_IDS: Instrument[] = ["piano", "violin", "flute", "trumpet"];

const images: Record<Instrument, string> = {
  piano: "/images/piano-3d.jpg",
  violin: "/images/violin-3d.jpg",
  flute: "/images/flute-3d.jpg",
  trumpet: "/images/trumpet-3d.jpg",
};

export default function ChooseMediumPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<Instrument | null>(null);
  const t = useTranslations("chooseMedium");

  const instruments = INSTRUMENT_IDS.map((id) => ({
    id,
    name: t(`instruments.${id}`),
    image: images[id],
  }));

  const handleSelect = (instrument: Instrument) => {
    setSelected(instrument);
    setState({
      composition: {
        id: generateId(),
        instrument,
        notes: [],
        duration: 30,
        createdAt: new Date().toISOString(),
      },
    });
    setTimeout(() => {
      router.push("/compose");
    }, 300);
  };

  return (
    <motion.div
      className="flex-1 flex flex-col min-h-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      style={{
        background: "linear-gradient(180deg, #ffffff 0%, #fafafa 50%, #f5f5f5 100%)",
      }}
    >
      <div className="flex flex-col items-center w-full max-w-[300px] pt-[26px] mx-auto">
        <motion.div
          className="flex flex-col gap-[32px] w-full"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1, ease: "easeOut" }}
        >
          <h1 className="font-title text-[16px] font-bold uppercase tracking-[1.6px] text-black text-center w-full">
            {t("title")}
          </h1>

          <div className="grid grid-cols-2 gap-x-[10px] gap-y-[32px] w-full">
            {instruments.map((instrument) => (
              <motion.button
                key={instrument.id}
                onClick={() => handleSelect(instrument.id)}
                type="button"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.15, ease: "easeOut" }}
                className={`flex flex-col items-center gap-[12px] text-left ${
                  selected === instrument.id ? "opacity-70" : ""
                }`}
              >
                <div className="w-[145px] h-[205px] relative overflow-hidden bg-neutral-100 transition-shadow duration-300 hover:shadow-md">
                  <Image
                    src={instrument.image}
                    alt={instrument.name}
                    fill
                    className="object-cover transition-transform duration-300 hover:scale-105"
                    sizes="145px"
                    priority
                    placeholder="blur"
                    blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AswD/2Q=="
                  />
                </div>
                <p className="font-body text-[14px] tracking-[1.4px] text-black text-center w-full">
                  {instrument.name}
                </p>
              </motion.button>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
