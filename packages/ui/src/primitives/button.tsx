import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../cn"
import { controlSurface, type ButtonSurface, type ButtonTone } from "../surface"

/**
 * The chrome shadcn puts on every stock variant: the focus ring, the colour
 * transition, and the disabled fade.
 *
 * IT LIVES ON THE VARIANTS AND NOT ON THE BASE, and that is load-bearing. All
 * three fight the machined treatment and lose it its effect:
 *
 *   · `focus-visible:ring-2` compiles to a BOX-SHADOW, and so does the bevel —
 *     a ring wipes the bevel out the instant a keyboard user tabs to the
 *     button, and it is invisible until focused. `.mach` uses `outline`.
 *   · `focus-visible:outline-none` would then kill that outline.
 *   · `transition-colors` REPLACES the transition property list, so the press
 *     and the shadow stop animating.
 *   · `disabled:opacity-50` at 50% turns three inset shadows into a smear.
 *
 * Keeping them here means `variant: "surfaced"` opts out of all four at once,
 * while `buttonVariants({ variant: "outline" })` still emits exactly the class
 * set it always did for the handful of places that call it directly.
 */
const STOCK_CHROME =
  "ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium disabled:pointer-events-none",
  {
    variants: {
      variant: {
        default: STOCK_CHROME + " bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          STOCK_CHROME + " bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          STOCK_CHROME + " border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          STOCK_CHROME + " bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: STOCK_CHROME + " hover:bg-accent hover:text-accent-foreground",
        link: STOCK_CHROME + " text-primary underline-offset-4 hover:underline",
        /**
         * No fill, no ring, no fade, no colour transition — a treatment from
         * `controlSurface()` supplies all of them. Geometry and type only.
         */
        surfaced: "",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

/**
 * WHICH ROLE EACH STOCK VARIANT PLAYS.
 *
 * This table is what makes "doing nothing" follow the flag. A call site that
 * writes `<Button>Try again</Button>` or `<Button variant="outline">` has
 * already named its role in the only vocabulary it had; mapping that to a tone
 * means the whole storefront reskins from `DEFAULT_BUTTON_SURFACE` without
 * ~90 call sites being touched — and a call site that DOES want to be excused
 * has to type `surface="neo"` on purpose.
 *
 * `link` is absent deliberately: it is a text link wearing a button's props,
 * not a key, and a bevel on it would be wrong.
 */
const TONE_FOR_VARIANT: Record<string, ButtonTone | undefined> = {
  default: "primary",
  destructive: "critical",
  outline: "default",
  secondary: "default",
  ghost: "plain",
  link: undefined,
  surfaced: "default",
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  /**
   * The button's ROLE. Defaults from `variant`, so it rarely needs setting —
   * pass it when `variant` would map to the wrong role, or to be explicit on a
   * button whose job matters (the checkout CTAs name theirs).
   *
   * `"none"` opts out of the treatment entirely and renders the stock shadcn
   * variant. Reserved for controls that are not keys.
   */
  tone?: ButtonTone | "none"
  /**
   * ESCAPE HATCH. Pin a treatment instead of following the flag. This is the
   * ONLY way to be excused, and every use of it is one grep away:
   *
   *     grep -rn 'surface="neo"' packages
   */
  surface?: ButtonSurface
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, tone, surface, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    const resolvedTone =
      tone === "none" ? undefined : (tone ?? TONE_FOR_VARIANT[variant ?? "default"])

    // No tone — `variant="link"`, or an explicit opt-out. Stock shadcn.
    if (!resolvedTone) {
      return (
        <Comp
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          {...props}
        />
      )
    }

    return (
      <Comp
        className={cn(
          buttonVariants({
            variant: "surfaced",
            size,
            // `className` LAST so a call site still wins on a genuine one-off.
            className: cn(controlSurface(resolvedTone, surface), className),
          })
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
