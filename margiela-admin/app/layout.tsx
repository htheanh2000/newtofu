import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Account",
  description: "Admin account for users and compositions",
};

// Polyfill crypto.randomUUID for http (e.g. S3 website) where it may be undefined
const randomUUIDPolyfill = `
  if (typeof crypto !== 'undefined' && !crypto.randomUUID) {
    crypto.randomUUID = function randomUUID() {
      var bytes = new Uint8Array(16);
      if (crypto.getRandomValues) crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      var h = function(b) { return b.toString(16).padStart(2,'0'); };
      return [h(bytes[0])+h(bytes[1])+h(bytes[2])+h(bytes[3]), h(bytes[4])+h(bytes[5]), h(bytes[6])+h(bytes[7]), h(bytes[8])+h(bytes[9]), h(bytes[10])+h(bytes[11])+h(bytes[12])+h(bytes[13])+h(bytes[14])+h(bytes[15])].join('-');
    };
  }
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-100 text-neutral-900 antialiased">
        <Script
          id="crypto-randomuuid-polyfill"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: randomUUIDPolyfill }}
        />
        {children}
      </body>
    </html>
  );
}
