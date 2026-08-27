import type * as React from "react";
import { BrandLogo } from "@plaspool/brand";
import { cn } from "@plaspool/ui";

import { threadReplies } from "../data/reviews";
import type { ReviewReply } from "../data/reviews";

/**
 * The conversation under a review.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * `authorKind` DECIDES WHO LOOKS OFFICIAL. NEVER THE NAME.
 *
 * Deciding from `authorName === "PlaSpool"` breaks the day a customer is called
 * that — and the failure is a shopper wearing the shop's logomark under a
 * review they wrote, which is exactly the impersonation the field exists to
 * prevent. Nothing in this file reads the name to make a decision; it only
 * prints it.
 *
 * ═══ THREE SIGNALS, BECAUSE ONE OF THEM IS ALWAYS MISSING ═══
 * The logomark carries nothing with images off. A colour carries nothing in
 * monochrome. So an owner reply is marked by the logomark AND a text badge AND
 * a tinted panel, and any one of them alone still says "the shop said this".
 *
 * ═══ THEY ARRIVE FLAT ═══
 * `threadReplies` builds the one-level tree by grouping on `parentId`; the API
 * sends every reply, nested or not, in a single array already ordered
 * oldest-first. Nothing here re-sorts it.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function ReviewReplies({
  replies,
  replyControl,
  className,
}: {
  replies: ReviewReply[];
  /**
   * The control for replying TO a reply, rendered only on depth-0 rows.
   *
   * TWO LEVELS IS THE CEILING — the API answers `400 parentId` for a reply to a
   * depth-1 reply — so the control is hidden there rather than offering a
   * refusal. A customer who finds the wall by hitting it has been told about a
   * rule by being refused, which is the worst way to learn one.
   *
   * A render prop rather than the form itself, so this component stays
   * renderable in a test without a session, a network or a provider.
   */
  replyControl?: (parentId: string) => React.ReactNode;
  className?: string;
}) {
  const thread = threadReplies(replies);
  if (thread.length === 0) return null;

  return (
    <ul className={cn("mt-4 flex flex-col gap-3 border-l-2 border-brand-line pl-4", className)}>
      {thread.map((node) => (
        <li key={node.reply.id}>
          <ReplyRow reply={node.reply} />
          {replyControl && <div className="mt-2">{replyControl(node.reply.id)}</div>}
          {node.children.length > 0 && (
            /* ONE LEVEL, THEN STOP. `depth` is 0 or 1 and the API refuses a
               reply to a depth-1 reply with `400 parentId`, so there is no
               third rung to render and no recursion here. */
            <ul className="mt-3 flex flex-col gap-3 border-l-2 border-brand-line pl-4">
              {node.children.map((child) => (
                <li key={child.id}>
                  <ReplyRow reply={child} />
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

function ReplyRow({ reply }: { reply: ReviewReply }) {
  const owner = reply.authorKind === "owner";

  return (
    <div className={cn("px-3 py-2", owner && "border border-brand-line bg-brand-soft")}>
      <div className="flex items-center gap-2">
        {owner && (
          /* `priority={false}`: a thread can hold several of these, and
             `BrandLogo` defaults to true — preloading the same file once per
             reply pushes the real content down the queue. See its own header. */
          <BrandLogo
            variant="mark"
            tone="light"
            priority={false}
            alt=""
            className="h-5 w-5 shrink-0"
          />
        )}
        {/* THE FIELD, NOT A CONSTANT. The server sets the owner's display name,
            so a rename is one change there and none here. */}
        <span className="min-w-0 truncate font-sans text-sm font-semibold text-foreground">
          {reply.authorName}
        </span>
        {owner && (
          <span className="shrink-0 border border-brand-line bg-background px-1.5 py-0 font-sans text-[11px] font-semibold uppercase tracking-wide text-brand">
            Shop
          </span>
        )}
      </div>
      <p className="mt-1 whitespace-pre-line font-sans text-sm leading-6 text-muted-foreground">
        {reply.body}
      </p>
    </div>
  );
}
