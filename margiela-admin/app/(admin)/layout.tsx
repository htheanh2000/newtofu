"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useCallback, useEffect } from "react";
import { signOut } from "@/lib/neon-client";

const nav = [{ href: "/users/", label: "Data" }] as const;

const STORAGE_KEY = "margiela-admin-sidebar-collapsed";

function ChevronLeft(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRight(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export default function AdminLayout({
  children,
}: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) setCollapsed(JSON.parse(stored));
    } catch {
      // ignore
    }
  }, []);

  const toggleSidebar = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  async function handleLogout() {
    try {
      await signOut();
    } finally {
      router.replace("/");
    }
  }

  return (
    <div className="flex min-h-screen">
      <aside
        className={`shrink-0 border-r border-neutral-200 bg-white transition-[width] duration-200 ease-in-out ${
          collapsed ? "w-16" : "w-56"
        }`}
      >
        <div className="sticky top-0 flex flex-col gap-1 p-3">
          <div
            className={`mb-4 flex items-center gap-1 px-2 ${
              collapsed ? "justify-center" : "justify-between"
            }`}
          >
            <span
              className={`text-sm font-semibold text-neutral-900 ${
                collapsed ? "truncate" : ""
              }`}
              title={collapsed ? "Account" : undefined}
            >
              {collapsed ? "A" : "Account"}
            </span>
            <button
              type="button"
              onClick={toggleSidebar}
              className="shrink-0 rounded p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <ChevronRight className="h-5 w-5" />
              ) : (
                <ChevronLeft className="h-5 w-5" />
              )}
            </button>
          </div>
          {nav.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                pathname === href
                  ? "bg-neutral-100 text-neutral-900"
                  : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
              } ${collapsed ? "justify-center px-2" : ""}`}
            >
              {collapsed ? (
                <span className="font-semibold">{label[0]}</span>
              ) : (
                label
              )}
            </Link>
          ))}
          <button
            type="button"
            onClick={handleLogout}
            className={`mt-4 rounded-lg px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700 ${
              collapsed ? "text-center" : "text-left"
            }`}
            title={collapsed ? "Log out" : undefined}
          >
            {collapsed ? "Out" : "Log out"}
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
