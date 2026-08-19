import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { DocRenderer } from "./doc-renderer";
import type { DocNode } from "../data/types";

/**
 * THE ALLOW-LIST IS A SECURITY BOUNDARY, not a rendering convenience.
 *
 * These documents arrive from another service. Nothing in one may become
 * markup unless its node type is listed in the renderer's switch, and no href
 * may reach the DOM unless `isAllowedHref` passed it. Rendered through
 * `react-dom/server` rather than jsdom because that is how these components
 * actually run — they are Server Components.
 */

const render = (doc: DocNode) => renderToStaticMarkup(<DocRenderer doc={doc} />);
const text = (value: string): DocNode => ({ type: "text", text: value });
const para = (...content: DocNode[]): DocNode => ({ type: "paragraph", content });
const doc = (...content: DocNode[]): DocNode => ({ type: "doc", content });

describe("unknown node types", () => {
  /* The one property the whole design rests on: an unknown node keeps its
     words and drops its shape. It must not disappear (silent content loss)
     and it must not render (arbitrary markup from another service). */
  it("renders an unknown node's children as text, never as its own element", () => {
    const html = render(
      doc({ type: "iframe", attrs: { src: "https://evil.com" }, content: [text("caption")] }),
    );
    expect(html).toBe("caption");
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("evil.com");
  });

  it("drops an unknown node with no children entirely", () => {
    expect(render(doc({ type: "script", attrs: { src: "https://evil.com/x.js" } }))).toBe("");
  });

  it("escapes text rather than interpreting it as markup", () => {
    const html = render(doc(para(text("<img src=x onerror=alert(1)>"))));
    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<img");
  });

  it("ignores an unknown mark instead of falling through to markup", () => {
    const html = render(doc(para({ type: "text", text: "hi", marks: [{ type: "onclick" }] })));
    expect(html).toBe("<p>hi</p>");
  });
});

describe("link hrefs", () => {
  const link = (href: string) =>
    render(doc(para({ type: "text", text: "click", marks: [{ type: "link", attrs: { href } }] })));

  it("allows http, https, mailto and tel", () => {
    for (const href of [
      "https://example.com/",
      "http://example.com/",
      "mailto:a@b.com",
      "tel:+2348000000000",
    ]) {
      expect(link(href)).toContain(`href="${href}"`);
    }
  });

  it("allows a root-relative link and keeps it same-tab with no nofollow", () => {
    const html = link("/posts/hello");
    expect(html).toContain('href="/posts/hello"');
    expect(html).not.toContain("target=");
    expect(html).not.toContain("nofollow");
  });

  it("sends an external link to a new tab with rel protections", () => {
    const html = link("https://example.com/");
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
  });

  it("rejects script-bearing and unknown schemes", () => {
    for (const href of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "data:text/html;base64,PHNjcmlwdD4=",
      "vbscript:msgbox(1)",
      "file:///etc/passwd",
    ]) {
      const html = link(href);
      expect(html).toBe("<p>click</p>");
      expect(html).not.toContain("href");
    }
  });

  /* Per the WHATWG URL spec a browser normalises a leading backslash to a
     forward slash, so `/\evil.com` navigates to evil.com exactly as
     `//evil.com` does. A bare `!startsWith("//")` check is not enough. */
  it("rejects every protocol-relative spelling of an external host", () => {
    for (const href of ["//evil.com", "///evil.com", "/\\evil.com", "\\\\evil.com", "/\\/evil.com"]) {
      const html = link(href);
      expect(html).toBe("<p>click</p>");
      expect(html).not.toContain("evil.com");
    }
  });
});

describe("images", () => {
  const image = (src: string) => render(doc({ type: "image", attrs: { src, alt: "a" } }));

  it("renders an allowed src through imageUrl", () => {
    expect(image("/api/public/images/abc123")).toContain('src="/images/blog/abc123"');
  });

  it("drops an image whose src fails the same allow-list as a link", () => {
    for (const src of ["javascript:alert(1)", "//evil.com/x.png", "/\\evil.com/x.png"]) {
      expect(image(src)).toBe("");
    }
  });
});

describe("known nodes still render", () => {
  it("renders the vocabulary the prose stylesheet is written against", () => {
    const html = render(
      doc(
        { type: "heading", attrs: { level: 3 }, content: [text("Title")] },
        para(text("Body")),
        { type: "blockquote", content: [para(text("Quoted"))] },
        { type: "codeBlock", content: [text("const a = 1;")] },
        { type: "horizontalRule" },
      ),
    );
    expect(html).toContain("<h3>Title</h3>");
    expect(html).toContain("<p>Body</p>");
    expect(html).toContain('class="doc-quote"');
    expect(html).toContain('class="doc-code"');
    expect(html).toContain('class="doc-rule"');
  });

  it("falls back to h2 for any heading level other than 3", () => {
    expect(render(doc({ type: "heading", attrs: { level: 1 }, content: [text("T")] }))).toContain(
      "<h2>",
    );
  });

  it("keeps the checklist DOM the ported CSS positions against", () => {
    const html = render(
      doc({
        type: "taskList",
        content: [{ type: "taskItem", attrs: { checked: true }, content: [para(text("Done"))] }],
      }),
    );
    expect(html).toContain('data-type="taskList"');
    expect(html).toContain('data-checked="true"');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("<label>");
  });

  it("makes the table scroll container reachable by keyboard", () => {
    const html = render(
      doc({
        type: "table",
        content: [{ type: "tableRow", content: [{ type: "tableHeader", content: [para(text("H"))] }] }],
      }),
    );
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('role="region"');
    expect(html).toContain("<th>");
  });

  it("tolerates a document with no content at all", () => {
    expect(render({ type: "doc" })).toBe("");
  });
});
