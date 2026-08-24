import { Link } from "./link";
import { ChevronRight } from "lucide-react";
import { cn } from "@plaspool/ui";

/**
 * The trail above a product or category. The last crumb is the current page:
 * unlinked, `aria-current="page"`, and the only crumb allowed to truncate — a
 * product name like "PETG Carbon Fibre 1.75 mm, obsidian black, 1 kg" must
 * lose its tail rather than push the page sideways at 375 px.
 */

export interface BreadcrumbItem {
  label: string;
  /** Omit on the current page. */
  href?: string;
}

export interface BreadcrumbProps {
  trail: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ trail, className }: BreadcrumbProps) {
  if (trail.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={cn("w-full min-w-0", className)}>
      <ol className="flex w-full min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
        {trail.map((item, index) => {
          const last = index === trail.length - 1;
          return (
            <li
              key={`${item.label}-${index}`}
              className={cn(
                "flex items-center gap-1.5",
                last ? "min-w-0" : "shrink-0 whitespace-nowrap",
              )}
            >
              {index > 0 && (
                <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-brand-line" />
              )}
              {last || !item.href ? (
                <span
                  aria-current={last ? "page" : undefined}
                  className="min-w-0 truncate text-foreground"
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="min-w-0 truncate rounded-sm underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
