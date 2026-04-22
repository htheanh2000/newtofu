"use client";

import Image from "next/image";

interface LogoProps {
  className?: string;
  variant?: "icon" | "full";
}

export function Logo({ className = "", variant = "icon" }: LogoProps) {
  if (variant === "full") {
    return (
      <div className={`flex flex-col items-center ${className}`}>
        <Image
          src="/images/logo-full.svg"
          alt="Maison Margiela Paris"
          width={174}
          height={100}
          className="object-contain"
          unoptimized
        />
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <Image
        src="/images/logo-margiela.png"
        alt="Margiela"
        width={58}
        height={34}
        className="object-contain"
        unoptimized
      />
    </div>
  );
}
