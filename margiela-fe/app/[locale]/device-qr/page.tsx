"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { useLocale } from "next-intl";

/**
 * Page that shows a QR code linking to the device registration flow.
 * Staff scan this QR to register their device; whitelisted devices can then scan
 * composition QR codes to view sheets / generate PDF.
 */
export default function DeviceQrPage() {
  const locale = useLocale();
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [registerUrl, setRegisterUrl] = useState<string>("");

  useEffect(() => {
    const base =
      typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_APP_URL ?? "";
    const url = `${base}/${locale}/register-device`;
    setRegisterUrl(url);
    QRCode.toDataURL(url, {
      width: 280,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    })
      .then(setQrDataUrl)
      .catch(console.error);
  }, [locale]);

  return (
    <div className="min-h-screen flex flex-col bg-white items-center justify-center px-5">
      <div className="w-full max-w-[320px] flex flex-col items-center gap-6 text-center">
        <h1 className="font-title text-[14px] uppercase tracking-[0.15em] text-black">
          Register device
        </h1>
        <p className="font-body text-[14px] text-black/80">
          Scan this QR with the device you want to whitelist. That device will
          then be allowed to scan composition QR codes and view sheets.
        </p>
        {qrDataUrl && (
          <div className="bg-white p-4 rounded-lg border border-black/10">
            <Image
              src={qrDataUrl}
              alt="QR code to register device"
              width={280}
              height={280}
              unoptimized
            />
          </div>
        )}
        {registerUrl && (
          <p className="font-mono text-[11px] text-black/60 break-all">
            {registerUrl}
          </p>
        )}
      </div>
    </div>
  );
}
