import { Factory, Layers, Ruler, Shield, Thermometer, Truck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@plaspool/ui";

import type { OverviewClaim, OverviewIcon } from "../data/types";

/**
 * Minimal on purpose: a few claims and an icon row, not a wall. The long copy
 * lives in Description, the numbers live in Printing parameters, and this tab
 * is what someone reads if they read exactly one thing.
 */

const ICONS: Record<OverviewIcon, LucideIcon> = {
  factory: Factory,
  ruler: Ruler,
  truck: Truck,
  layers: Layers,
  thermometer: Thermometer,
  shield: Shield,
};

export interface OverviewTabProps {
  claims: OverviewClaim[];
  /** The one-liner under the product title, repeated here as the lead. */
  summary: string;
  className?: string;
}

export function OverviewTab({ claims, summary, className }: OverviewTabProps) {
  return (
    <div className={cn("max-w-3xl", className)}>
      <p className="text-base leading-7 text-foreground">{summary}</p>

      {claims.length > 0 && (
        <ul className="mt-8 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
          {claims.map((claim) => {
            const Icon = ICONS[claim.icon];
            return (
              <li key={claim.title} className="flex flex-col gap-2">
                <Icon aria-hidden="true" className="h-5 w-5 text-brand" />
                {/*
                  The title is frequently a measurement ("±0.02 mm"), so it is
                  monospace — which is also correct for the ones that are not,
                  because a row of claim titles that switch face reads as a
                  mistake rather than as a distinction.
                */}
                <p className="font-mono text-sm font-bold tabular-nums text-foreground">
                  {claim.title}
                </p>
                <p className="text-sm leading-6 text-muted-foreground">{claim.body}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
