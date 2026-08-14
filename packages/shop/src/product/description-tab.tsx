import { cn } from "@plaspool/ui";

import type { DescriptionBlock } from "../data/types";
import { SpoolImage } from "../components/spool-image";

/**
 * The rich tab: headings, prose, tables and figures. Rendered from
 * `DescriptionBlock[]` rather than from markup, so the same component serves a
 * CMS later without changing.
 *
 * An allow-list over a union — an unknown block kind renders nothing rather
 * than throwing, which is the behaviour that survives a CMS growing a block
 * type this build has never heard of.
 *
 * There is no product photography anywhere in this store, so a `figure` block
 * is a tinted spool. That is the design system's third rule and it is why the
 * block carries a `colourHex` instead of a URL.
 */

export interface DescriptionTabProps {
  blocks: DescriptionBlock[];
  className?: string;
}

export function DescriptionTab({ blocks, className }: DescriptionTabProps) {
  return (
    <div className={cn("max-w-3xl", className)}>
      {blocks.map((block, index) => {
        const key = `${block.kind}-${index}`;

        switch (block.kind) {
          case "heading":
            return (
              <h3
                key={key}
                className="mt-10 font-sans text-lg font-semibold text-foreground first:mt-0"
              >
                {block.text}
              </h3>
            );

          case "paragraph":
            return (
              <p key={key} className="mt-4 text-base leading-7 text-muted-foreground">
                {block.text}
              </p>
            );

          case "bullets":
            return (
              <ul key={key} className="mt-4 flex flex-col gap-2">
                {block.items.map((item, i) => (
                  <li
                    key={i}
                    className="flex gap-3 text-base leading-7 text-muted-foreground"
                  >
                    <span aria-hidden="true" className="mt-3 h-px w-3 shrink-0 bg-brand-line" />
                    <span className="min-w-0">{item}</span>
                  </li>
                ))}
              </ul>
            );

          case "table":
            return (
              <figure key={key} className="mt-8">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[20rem] border-collapse text-sm">
                    <caption className="sr-only">{block.caption}</caption>
                    <thead>
                      <tr className="border-b border-brand-line">
                        {block.head.map((cell) => (
                          <th
                            key={cell}
                            scope="col"
                            className="px-2 pb-2 text-left font-sans text-xs font-semibold text-muted-foreground"
                          >
                            {cell}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {block.rows.map((row, r) => (
                        <tr key={r} className="border-b border-brand-line last:border-b-0">
                          {row.map((cell, c) => (
                            <td
                              key={c}
                              className="px-2 py-3 align-top text-sm leading-6 text-foreground"
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <figcaption className="mt-2 px-2 text-xs text-muted-foreground">
                  {block.caption}
                </figcaption>
              </figure>
            );

          case "figure":
            return (
              <figure key={key} className="mt-8">
                {/*
                  `SpoolImage` fills its flange and bore with the background
                  token, so it needs a background or card surface under it —
                  never a tinted or dark ground.
                */}
                <div className="flex justify-center rounded-lg border border-brand-line bg-background p-6">
                  <SpoolImage
                    colourHex={block.colourHex}
                    weightGrams={1000}
                    label={block.caption}
                    className="max-w-[16rem]"
                  />
                </div>
                <figcaption className="mt-2 text-xs text-muted-foreground">
                  {block.caption}
                </figcaption>
              </figure>
            );

          default:
            return null;
        }
      })}
    </div>
  );
}
