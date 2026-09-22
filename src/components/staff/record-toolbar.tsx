"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { fiscalYearLabel } from "@/lib/fiscal-year";

export function RecordToolbar({
  fiscalYear,
  fiscalYearOptions,
  live,
  csvHref,
}: {
  fiscalYear: number;
  fiscalYearOptions: number[];
  live: boolean;
  csvHref: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function hrefFor(fy: number, isLive: boolean) {
    const params = new URLSearchParams();
    params.set("fy", String(fy));
    if (isLive) params.set("live", "1");
    return `${pathname}?${params.toString()}`;
  }

  return (
    <div className="print-hidden flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-2 text-sm text-gray-700">
        Fiscal year
        <select
          value={fiscalYear}
          onChange={(e) => router.push(hrefFor(Number(e.target.value), live))}
          className="h-8 rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          {fiscalYearOptions.map((fy) => (
            <option key={fy} value={fy}>
              {fiscalYearLabel(fy)}
            </option>
          ))}
        </select>
      </label>
      <Button variant={live ? "default" : "outline"} size="sm" nativeButton={false} render={<Link href={hrefFor(fiscalYear, !live)} />} aria-pressed={live}>
        {live ? "Live view on" : "Live view"}
      </Button>
      <Button variant="outline" size="sm" onClick={() => window.print()}>
        Print / Save as PDF
      </Button>
      <Button variant="outline" size="sm" nativeButton={false} render={<a href={csvHref} download />}>
        Download CSV
      </Button>
    </div>
  );
}
