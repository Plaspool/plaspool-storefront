import { Fragment, type ReactNode } from "react";
import { imageUrl } from "../data/posts";
import type { DocNode } from "../data/types";

/**
 * Renders the block document to React elements.
 *
 * Deliberately NOT `dangerouslySetInnerHTML`: nothing in the document can
 * become markup unless it matches a node type listed here. An unknown node
 * renders its children as plain text rather than disappearing or executing.
 * These documents arrive from another service, so that property is the point.
 *
 * THE MARKUP VOCABULARY IS THE ADMIN APP'S (`doc-quote`, `doc-code`,
 * `doc-tasks`, `doc-table-wrap`, …), synced as part of the design-system
 * port (#15): the ported prose stylesheet describes both renderers, and body
 * rendering is where a reader spends their time — matching chrome around a
 * mismatched article would miss the whole point. The checklist DOM in
 * particular (li > label(input + span) + div) is load-bearing: the ported
 * CSS positions the box against the first line box of that exact shape.
 *
 * Two deliberate divergences from the admin renderer:
 * - No syntax highlighting. lowlight and its grammars are an editor-sized
 *   dependency; code blocks render as plain text on the dark code surface,
 *   and the hljs colour ramp is already in the stylesheet for the day this
 *   changes.
 * - Root-relative links stay same-tab with no `nofollow` — these are the
 *   site's own SEO surface. The admin sends every link to a new tab because
 *   its reader is a workspace someone is in the middle of using.
 */
export function DocRenderer({ doc }: { doc: DocNode }) {
  return <>{(doc.content ?? []).map((n, i) => renderNode(n, i))}</>;
}

/**
 * Same allow-list the editor gates links on. A single slash with a
 * non-slash, non-backslash character right after it is root-relative and
 * allowed. Anything where the browser would instead read the start of the
 * string as "an authority follows" is rejected: `//host`, `///host`,
 * `/\host`, `\\host`. Per the WHATWG URL spec, browsers normalise a
 * leading backslash to a forward slash when resolving a relative
 * reference against an http(s) page, so `/\evil.com` parses identically
 * to `//evil.com` — both hand navigation to evil.com — which is why a
 * bare `!startsWith("//")` check is not enough on its own.
 */
function isAllowedHref(href: string): boolean {
  return (
    /^(https?:|mailto:|tel:)/i.test(href) ||
    /^\/(?![\\/])/.test(href)
  );
}

function renderNode(node: DocNode, key: number): ReactNode {
  const kids = () => (node.content ?? []).map((n, i) => renderNode(n, i));

  switch (node.type) {
    case "text":
      return <Fragment key={key}>{applyMarks(node)}</Fragment>;
    case "paragraph":
      return <p key={key}>{kids()}</p>;
    case "heading": {
      const Tag = Number(node.attrs?.level) === 3 ? "h3" : "h2";
      return <Tag key={key}>{kids()}</Tag>;
    }
    case "blockquote":
      return (
        <blockquote key={key} className="doc-quote">
          {kids()}
        </blockquote>
      );
    case "bulletList":
      return <ul key={key}>{kids()}</ul>;
    case "orderedList":
      return (
        <ol key={key} start={Number(node.attrs?.start) || undefined}>
          {kids()}
        </ol>
      );
    case "listItem":
      return <li key={key}>{kids()}</li>;
    case "taskList":
      return (
        <ul key={key} className="doc-tasks" data-type="taskList">
          {kids()}
        </ul>
      );
    case "taskItem": {
      const checked = !!node.attrs?.checked;
      return (
        <li key={key} data-checked={String(checked)} data-type="taskItem">
          <label>
            <input
              type="checkbox"
              checked={checked}
              readOnly
              disabled
              aria-label={plainText(node) || "task item"}
            />
            <span />
          </label>
          <div>{kids()}</div>
        </li>
      );
    }
    case "codeBlock":
      return (
        <pre key={key} className="doc-code">
          <code>{plainText(node)}</code>
        </pre>
      );
    case "table":
      return (
        <div
          key={key}
          className="doc-table-wrap"
          // A scroll container only a mouse can reach is a trap, and on a
          // narrow screen this one always overflows. Give it a tab stop.
          tabIndex={0}
          role="region"
          aria-label="Table"
        >
          <table className="doc-table">
            {colGroup(node)}
            <tbody>{kids()}</tbody>
          </table>
        </div>
      );
    case "tableRow":
      return <tr key={key}>{kids()}</tr>;
    case "tableHeader":
      return (
        <th key={key} {...cellSpans(node)}>
          {kids()}
        </th>
      );
    case "tableCell":
      return (
        <td key={key} {...cellSpans(node)}>
          {kids()}
        </td>
      );
    case "horizontalRule":
      return <hr key={key} className="doc-rule" />;
    case "hardBreak":
      return <br key={key} />;
    case "image": {
      const src = String(node.attrs?.src ?? "");
      const alt = String(node.attrs?.alt ?? "");
      const caption = String(node.attrs?.title ?? "");
      if (!isAllowedHref(src)) return null;
      return (
        <figure key={key} className="doc-figure">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="doc-image"
            src={imageUrl(src)}
            alt={alt}
            loading="lazy"
            decoding="async"
          />
          {caption && <figcaption className="doc-caption">{caption}</figcaption>}
        </figure>
      );
    }
    default:
      // Unknown block: keep the words, drop the unknown shape.
      return <Fragment key={key}>{kids()}</Fragment>;
  }
}

function applyMarks(node: DocNode): ReactNode {
  let out: ReactNode = node.text ?? "";
  for (const mark of node.marks ?? []) {
    switch (mark.type) {
      case "bold":
        out = <strong>{out}</strong>;
        break;
      case "italic":
        out = <em>{out}</em>;
        break;
      case "underline":
        out = <u>{out}</u>;
        break;
      case "strike":
        out = <s>{out}</s>;
        break;
      case "code":
        out = <code>{out}</code>;
        break;
      case "link": {
        const href = String(mark.attrs?.href ?? "");
        if (isAllowedHref(href)) {
          // Internal (root-relative) links stay plain: no new tab, no nofollow
          // — these are the site's own SEO surface. External links get both.
          out = href.startsWith("/") ? (
            <a className="doc-link" href={href}>
              {out}
            </a>
          ) : (
            <a
              className="doc-link"
              href={href}
              target="_blank"
              rel="noopener noreferrer nofollow"
            >
              {out}
            </a>
          );
        }
        break;
      }
      default:
        break;
    }
  }
  return out;
}

function plainText(node: DocNode): string {
  return (node.content ?? []).map((n) => n.text ?? plainText(n)).join("");
}

function cellSpans(node: DocNode) {
  const colSpan = Number(node.attrs?.colspan) || 1;
  const rowSpan = Number(node.attrs?.rowspan) || 1;
  return {
    colSpan: colSpan > 1 ? colSpan : undefined,
    rowSpan: rowSpan > 1 ? rowSpan : undefined,
  };
}

/**
 * Column widths live on the first row's cells, the same place ProseMirror's
 * table view reads them from, so a table the writer resized in the editor
 * reads at the width it was written at. Ported with the markup sync — the
 * old renderer dropped them, which is exactly the class of drift #15 calls
 * out: the two surfaces disagreeing about the same document.
 */
function colGroup(table: DocNode): ReactNode {
  const firstRow = (table.content ?? []).find((n) => n.type === "tableRow");
  if (!firstRow) return null;
  const widths: (number | null)[] = [];
  for (const cell of firstRow.content ?? []) {
    const span = Number(cell.attrs?.colspan) || 1;
    const cw = cell.attrs?.colwidth;
    const list = Array.isArray(cw) ? (cw as unknown[]) : null;
    for (let i = 0; i < span; i += 1) {
      const w = Number(list?.[i]);
      widths.push(Number.isFinite(w) && w > 0 ? w : null);
    }
  }
  if (!widths.some((w) => w !== null)) return null;
  return (
    <colgroup>
      {widths.map((w, i) => (
        <col key={i} style={w ? { width: w } : undefined} />
      ))}
    </colgroup>
  );
}
