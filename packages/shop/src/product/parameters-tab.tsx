import { cn } from "@plaspool/ui";

import type { PrintingParameters } from "../data/types";

/**
 * "Will this actually print on my machine?" — the dominant anxiety on a
 * filament page, and the one this tab exists to answer. Modelled on eSUN's
 * parameter table, which is the clearest of the three references, extended
 * with diameter tolerance and drying.
 *
 * A datasheet, not a widget: hairline rules, no card chrome, and every
 * measured quantity in monospace so a column of figures lines up. That is the
 * design system's rule for this table and the bulk-tier ladder specifically.
 */

/** `[190, 220]` → `190–220`. An en dash, because it is a range. */
function range(pair: [number, number]): string {
  return pair[0] === pair[1] ? String(pair[0]) : `${pair[0]}–${pair[1]}`;
}

interface Row {
  label: string;
  /** The measured value. Monospace. */
  value: string;
  /** Optional prose qualifier, in sans, beside the figure. */
  note?: string;
}

function rowsFor(p: PrintingParameters): Row[] {
  return [
    { label: "Extruder temperature", value: `${range(p.extruderTempC)} °C` },
    { label: "Bed temperature", value: `${range(p.bedTempC)} °C` },
    { label: "Print speed", value: `${range(p.printSpeedMmS)} mm/s` },
    { label: "Cooling fan", value: `${p.fanPercent}%` },
    { label: "Density", value: `${p.densityGCm3} g/cm³` },
    { label: "Diameter tolerance", value: `±${p.diameterToleranceMm} mm` },
    {
      label: "Drying",
      value: `${p.dryingTempC} °C`,
      note: `for ${p.dryingHours} hours`,
    },
    {
      label: "Enclosure",
      /* Not a measurement, so this one is deliberately not monospace — see
         the `mono` flag below. */
      value: p.enclosureRequired ? "Required" : "Not required",
    },
  ];
}

/** Everything except the enclosure verdict is a measured quantity. */
const PROSE_LABELS = new Set(["Enclosure"]);

export interface ParametersTabProps {
  parameters: PrintingParameters;
  className?: string;
}

export function ParametersTab({ parameters, className }: ParametersTabProps) {
  const rows = rowsFor(parameters);

  return (
    <div className={cn("max-w-2xl", className)}>
      {/* Wide content scrolls inside its own container rather than pushing the
          page sideways at 375 px. */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[18rem] border-collapse text-sm">
          <caption className="sr-only">
            Recommended printing parameters for this filament
          </caption>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-brand-line last:border-b-0">
                <th
                  scope="row"
                  className="py-3 pr-4 text-left align-baseline text-sm font-normal text-muted-foreground"
                >
                  {row.label}
                </th>
                <td className="py-3 text-right align-baseline">
                  <span
                    className={cn(
                      "text-foreground",
                      PROSE_LABELS.has(row.label)
                        ? ""
                        : "font-mono font-bold tabular-nums",
                    )}
                  >
                    {row.value}
                  </span>
                  {row.note && (
                    <span className="ml-1.5 text-muted-foreground">{row.note}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/*
        eSUN's best idea and the cheapest thing on this page: one plain
        sentence about handling the material. "Do not over-tighten the extruder
        on matte PLA" is the model — it prevents a return and costs nothing.
      */}
      <p className="mt-6 border-l-2 border-brand pl-4 text-sm leading-6 text-muted-foreground">
        {parameters.handlingNote}
      </p>

      <p className="mt-6 text-xs leading-5 text-muted-foreground">
        Starting points, not gospel — every printer runs a little hot or a
        little cold. Print a temperature tower if your first layer misbehaves.
      </p>
    </div>
  );
}
