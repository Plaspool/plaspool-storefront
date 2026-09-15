import { Check } from "lucide-react";
import { cn } from "@plaspool/ui";

/**
 * The buy box's feature bullets.
 *
 * ═══ NO FEATURES, NO MARKUP — DIVIDER INCLUDED ═══
 * `features` has no column behind it and arrives empty on every live product,
 * and this list used to render its top border and padding regardless. That
 * empty bordered block, sitting directly above the next bordered section, is
 * the pair of blank divider lines shoppers saw between Quantity and the rest.
 */
export function FeatureList({ features, className }: { features: readonly string[]; className?: string }) {
  if (features.length === 0) return null;
  return (
    <ul className={cn("flex flex-col gap-2 border-t border-brand-line pt-5", className)}>
      {features.map((feature) => (
        <li key={feature} className="flex gap-2 text-sm leading-6 text-muted-foreground">
          <Check aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-brand" />
          <span>{feature}</span>
        </li>
      ))}
    </ul>
  );
}
