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
 */
export function DocRenderer({ doc }: { doc: DocNode }) {
  return <>{(doc.content ?? []).map((n, i) => renderNode(n, i))}</>;
}

/**
 * Same allow-list the editor gates links on. A single leading slash is
 * root-relative and allowed; a double leading slash is protocol-relative
 * (browser resolves it to `<current-scheme>://evil.com`) and rejected.
 */
function isAllowedHref(href: string): boolean {
  return (
    /^(https?:|mailto:|tel:)/i.test(href) ||
    (href.startsWith("/") && !href.startsWith("//"))
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
      return <blockquote key={key}>{kids()}</blockquote>;
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
        <ul key={key} className="list-none pl-0">
          {kids()}
        </ul>
      );
    case "taskItem": {
      const checked = !!node.attrs?.checked;
      return (
        <li key={key} className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={checked}
            readOnly
            disabled
            aria-label={plainText(node) || "task item"}
            className="mt-1.5"
          />
          <div>{kids()}</div>
        </li>
      );
    }
    case "codeBlock":
      return (
        <pre key={key}>
          <code>{plainText(node)}</code>
        </pre>
      );
    case "table":
      return (
        <div
          key={key}
          className="overflow-x-auto"
          tabIndex={0}
          role="region"
          aria-label="Table"
        >
          <table>
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
      return <hr key={key} />;
    case "hardBreak":
      return <br key={key} />;
    case "image": {
      const src = String(node.attrs?.src ?? "");
      const alt = String(node.attrs?.alt ?? "");
      const caption = String(node.attrs?.title ?? "");
      if (!isAllowedHref(src)) return null;
      return (
        <figure key={key}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl(src)} alt={alt} loading="lazy" className="w-full" />
          {caption && <figcaption>{caption}</figcaption>}
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
            <a href={href}>{out}</a>
          ) : (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow">
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
