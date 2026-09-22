import Link from "next/link";
import { Fragment } from "react";

export type Crumb = { label: string; href?: string };

// Nested pages show a trail back to Home. The last item is the current page.
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="print-hidden mb-4 text-sm text-gray-600">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <Fragment key={`${item.label}-${index}`}>
              {index > 0 ? (
                <li aria-hidden="true" className="text-gray-400">
                  /
                </li>
              ) : null}
              <li>
                {item.href && !last ? (
                  <Link href={item.href} className="hover:text-gray-900 hover:underline">
                    {item.label}
                  </Link>
                ) : (
                  <span aria-current={last ? "page" : undefined} className="font-medium text-gray-900">
                    {item.label}
                  </span>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
