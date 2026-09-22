"use client";

import { usePathname, useRouter } from "next/navigation";
import { fiscalYearLabel } from "@/lib/fiscal-year";

export function FiscalYearSelect({
  value,
  options,
  current,
}: {
  value: number;
  options: number[];
  current: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <label className="flex items-center gap-2 text-sm text-gray-700">
      Fiscal year
      <select
        value={value}
        onChange={(e) => {
          const fy = Number(e.target.value);
          router.push(fy === current ? pathname : `${pathname}?fy=${fy}`);
        }}
        className="h-8 rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
      >
        {options.map((fy) => (
          <option key={fy} value={fy}>
            {fiscalYearLabel(fy)}
          </option>
        ))}
      </select>
    </label>
  );
}
