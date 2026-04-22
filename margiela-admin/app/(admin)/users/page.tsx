"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { getSession, fetchUsers, signOut, isAuthError, type AdminUser } from "@/lib/neon-client";
import { downloadCSV } from "@/lib/export-csv";
import { formatCreatedDate } from "@/lib/date-utils";

type SortKey = "createdAt" | "firstName" | "email";
type SortOrder = "asc" | "desc";

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

export default function UsersPage() {
  const router = useRouter();
  const [list, setList] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(
    20,
  );

  useEffect(() => {
    getSession().then((session) => {
      if (!session) router.replace("/");
    });
  }, [router]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    const session = await getSession();
    if (!session) return;
    setLoading(true);
    setError("");
    try {
      const data = await fetchUsers({
        search: debouncedSearch || undefined,
        sortBy,
        sortOrder,
      });
      setList(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      if (isAuthError(e)) {
        await signOut();
        router.replace("/");
        return;
      }
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, sortBy, sortOrder, router]);

  useEffect(() => {
    load();
  }, [load]);

  function handleExportCSV() {
    downloadCSV(
      "users-and-compositions.csv",
      list,
      [
        { key: "firstName", header: "First name", getValue: (r) => r.firstName },
        { key: "lastName", header: "Last name", getValue: (r) => r.lastName },
        { key: "email", header: "Email", getValue: (r) => r.email },
        { key: "gender", header: "Gender", getValue: (r) => r.gender },
        { key: "dateOfBirth", header: "Date of birth", getValue: (r) => r.dateOfBirth },
        { key: "country", header: "Country", getValue: (r) => r.country },
        { key: "state", header: "State", getValue: (r) => r.state ?? "" },
        { key: "city", header: "City", getValue: (r) => r.city },
        { key: "postcode", header: "Postcode", getValue: (r) => r.postcode },
        { key: "phone", header: "Phone", getValue: (r) => r.phone },
        {
          key: "userCreated",
          header: "User created",
          getValue: (r) => formatCreatedDate(r.createdAt),
        },
        { key: "compositionId", header: "Composition ID", getValue: (r) => r.compositionId },
        { key: "instrument", header: "Instrument", getValue: (r) => r.composition?.instrument ?? "" },
        { key: "duration", header: "Duration (s)", getValue: (r) => (r.composition?.duration != null ? String(r.composition.duration) : "") },
        {
          key: "compositionCreated",
          header: "Composition created",
          getValue: (r) => formatCreatedDate(r.composition?.createdAt),
        },
      ],
    );
  }

  const truncate = (v: string, title?: string) => (
    <span className="max-w-[300px] truncate block" title={title ?? (v && v !== "—" ? v : undefined)}>
      {v || "—"}
    </span>
  );

  const columns: ColumnDef<AdminUser>[] = [
    {
      accessorKey: "compositionId",
      header: "Composition ID",
      cell: (ctx) => {
        const id = ctx.getValue<string>();
        const base = process.env.NEXT_PUBLIC_VIEW_BASE_URL?.trim();
        const viewHref = base && id ? `${base.replace(/\/$/, "")}/en/view/${id}` : null;
        const content = (
          <span className="font-mono text-xs max-w-[300px] truncate block" title={id || undefined}>
            {id || "—"}
          </span>
        );
        if (viewHref) {
          return (
            <a
              href={viewHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline focus:outline-none focus:underline"
            >
              {content}
            </a>
          );
        }
        return content;
      },
    },
    { accessorKey: "firstName", header: "First name", cell: (ctx) => truncate(ctx.getValue<string>() || "—") },
    { accessorKey: "lastName", header: "Last name", cell: (ctx) => truncate(ctx.getValue<string>() || "—") },
    { accessorKey: "email", header: "Email", cell: (ctx) => truncate(ctx.getValue<string>() ?? "", ctx.getValue<string>() ?? undefined) },
    {
      accessorKey: "gender",
      header: () => <span className="min-w-[10rem] inline-block">Gender</span>,
      cell: (ctx) => (
        <span className="min-w-[10rem] inline-block whitespace-nowrap">
          {ctx.getValue<string>() || "—"}
        </span>
      ),
    },
    {
      accessorKey: "dateOfBirth",
      header: () => <span className="min-w-[10rem] inline-block">DOB</span>,
      cell: (ctx) => (
        <span className="min-w-[10rem] inline-block whitespace-nowrap">
          {ctx.getValue<string>() || "—"}
        </span>
      ),
    },
    { accessorKey: "country", header: "Country", cell: (ctx) => truncate(ctx.getValue<string>() || "—") },
    { accessorKey: "state", header: "State", cell: (ctx) => truncate(ctx.getValue<string | null>() ?? "—") },
    { accessorKey: "city", header: "City", cell: (ctx) => truncate(ctx.getValue<string>() || "—") },
    { accessorKey: "postcode", header: "Postcode", cell: (ctx) => ctx.getValue<string>() || "—" },
    { accessorKey: "phone", header: "Phone", cell: (ctx) => ctx.getValue<string>() || "—" },
    {
      accessorKey: "createdAt",
      header: "User created",
      cell: (ctx) => {
        const v = ctx.getValue<string | null>();
        return (
          <span className="text-neutral-500 whitespace-nowrap">
            {formatCreatedDate(v) || "—"}
          </span>
        );
      },
    },
    {
      id: "instrument",
      header: "Instrument",
      accessorFn: (row) => row.composition?.instrument ?? "—",
      cell: (ctx) => ctx.getValue<string>(),
    },
    {
      id: "duration",
      header: "Duration",
      accessorFn: (row) => row.composition?.duration ?? "—",
      cell: (ctx) => {
        const v = ctx.getValue<number | string>();
        return typeof v === "number" ? `${v}s` : v;
      },
    },
    {
      id: "compositionCreatedAt",
      header: "Composition created",
      accessorFn: (row) => row.composition?.createdAt ?? "",
      cell: (ctx) => {
        const v = ctx.getValue<string>();
        return (
          <span className="text-neutral-500 whitespace-nowrap">
            {formatCreatedDate(v) || "—"}
          </span>
        );
      },
    },
  ];

  const table = useReactTable({
    data: list,
    columns,
    state: {
      sorting,
    },
    onSortingChange: (updater) => {
      const next =
        typeof updater === "function" ? updater(sorting) : updater ?? [];
      setSorting(next);
      const first = next[0];
      if (first) {
        const col = first.id as SortKey;
        setSortBy(col);
        setSortOrder(first.desc ? "desc" : "asc");
      }
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageIndex: 0,
        pageSize,
      },
    },
  });

  useEffect(() => {
    table.setPageSize(pageSize);
  }, [pageSize, table]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-neutral-900">Users & Compositions</h1>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Search by name, email, phone, composition ID, instrument…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-72 rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
        />
        <button
          type="button"
          onClick={handleExportCSV}
          disabled={loading || list.length === 0}
          className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
        >
          Export all to CSV
        </button>
        <div className="ml-auto flex items-center gap-2 text-sm text-neutral-600">
          <span>Rows per page</span>
          <select
            className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
            value={pageSize}
            onChange={(e) =>
              setPageSize(Number(e.target.value) as (typeof PAGE_SIZE_OPTIONS)[number])
            }
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        {loading ? (
          <div className="p-8 text-center text-neutral-500">Loading…</div>
        ) : list.length === 0 ? (
          <div className="p-8 text-center text-neutral-500">No data found.</div>
        ) : (
          <>
            {/* <p className="px-4 py-2 text-xs text-neutral-500 border-b border-neutral-100">
              Kéo ngang để xem đầy đủ: User (First name, Email, Gender, DOB, Country, State, City, Postcode, Phone) + Composition (ID, Instrument, Duration).
            </p> */}
            <table className="w-full text-left text-sm min-w-[900px]">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr
                    key={headerGroup.id}
                    className="border-b border-neutral-200 bg-neutral-50"
                  >
                    {headerGroup.headers.map((header) => {
                      const isSortable = header.column.getCanSort();
                      const sortDir = header.column.getIsSorted();
                      return (
                        <th
                          key={header.id}
                          className={`px-4 py-3 font-medium ${
                            isSortable ? "cursor-pointer select-none" : ""
                          }`}
                          onClick={
                            isSortable
                              ? header.column.getToggleSortingHandler()
                              : undefined
                          }
                        >
                          <div className="flex items-center gap-1">
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                            {sortDir === "asc" && "↑"}
                            {sortDir === "desc" && "↓"}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-neutral-100 hover:bg-neutral-50"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3 align-middle">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between border-t border-neutral-200 px-4 py-3 text-xs text-neutral-600">
              <div>
                Page {table.getState().pagination.pageIndex + 1} of{" "}
                {table.getPageCount() || 1}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => table.setPageIndex(0)}
                  disabled={!table.getCanPreviousPage()}
                  className="rounded-md border border-neutral-300 px-2 py-1 disabled:opacity-40"
                >
                  « First
                </button>
                <button
                  type="button"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  className="rounded-md border border-neutral-300 px-2 py-1 disabled:opacity-40"
                >
                  ‹ Prev
                </button>
                <button
                  type="button"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  className="rounded-md border border-neutral-300 px-2 py-1 disabled:opacity-40"
                >
                  Next ›
                </button>
                <button
                  type="button"
                  onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                  disabled={!table.getCanNextPage()}
                  className="rounded-md border border-neutral-300 px-2 py-1 disabled:opacity-40"
                >
                  Last »
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
