"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getDeviceHeaders } from "@/lib/device-client";
import { Logo } from "@/components/ui/Logo";

export default function ViewSheetPage() {
  const params = useParams();
  const [status, setStatus] = useState<
    "loading" | "allowed" | "forbidden" | "notfound"
  >("loading");
  const [pdfUrl, setPdfUrl] = useState<string>("");

  useEffect(() => {
    const run = async () => {
      const id = params.id as string;
      if (!id) {
        setStatus("notfound");
        return;
      }
      try {
        const headers = getDeviceHeaders();
        const res = await fetch(`/api/view-sheet/${id}`, { headers });
        if (res.status === 403) {
          setStatus("forbidden");
          return;
        }
        if (res.status === 404) {
          setStatus("notfound");
          return;
        }
        if (!res.ok) {
          setStatus("notfound");
          return;
        }
        const data = await res.json();
        const url = data?.pdfUrl;
        if (typeof url === "string" && url) {
          setPdfUrl(url);
          setStatus("allowed");
        } else {
          setStatus("notfound");
        }
      } catch {
        setStatus("notfound");
      }
    };
    run();
  }, [params.id]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-black border-t-transparent rounded-full animate-spin mx-auto mb-6" />
          <p className="font-title text-[14px] uppercase tracking-widest text-black/70">
            Loading…
          </p>
        </div>
      </div>
    );
  }

  if (status === "forbidden") {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center px-8 pt-16">
        <Logo variant="icon" className="mb-20" />

        <div className="w-full max-w-[340px] flex flex-col items-center gap-10 text-center">
          <div className="flex flex-col gap-4">
            <p className="font-title text-[14px] leading-[1.6] tracking-[0.04em] text-black">
              Present your QR code to our staff at the
              Maison Margiela Store on Level 2
            </p>
            <p className="font-title text-[14px] leading-[1.6] tracking-[0.04em] text-black">
              Store location:
              <br />
              Shop 2081, Podium Level Two, ifc mall
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <p className="font-body text-[14px] leading-[1.6] tracking-[0.02em] text-black">
              請於 Maison Margiela
              <br />
              二樓專門店向店員出示你的 QR Code
            </p>
            <p className="font-body text-[14px] leading-[1.6] tracking-[0.02em] text-black">
              門店地址： IFC 商場二樓 2081 號舖
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (status === "notfound") {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-8">
        <div className="text-center">
          <h1 className="font-title text-[14px] uppercase tracking-[0.15em] text-black mb-4">
            Sheet not found
          </h1>
          <p className="font-body text-[14px] text-black/70">
            This link may be invalid or the PDF has not been generated yet.
          </p>
        </div>
      </div>
    );
  }

  if (typeof window !== "undefined") {
    window.location.href = pdfUrl;
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-black border-t-transparent rounded-full animate-spin mx-auto mb-6" />
        <p className="font-title text-[14px] uppercase tracking-widest text-black/70">
          Opening PDF…
        </p>
      </div>
    </div>
  );
}
