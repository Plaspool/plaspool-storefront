"use client";

import * as React from "react";
import { Link } from "../components/link";
import { Menu, Search, ShoppingCart, User } from "lucide-react";
import {
  Button,
  Input,
  ScrollArea,
  Separator,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  cn,
} from "@plaspool/ui";
import { BrandLogo } from "@plaspool/brand";

import { useCart } from "../cart/cart-context";
import { AccountMenu } from "../account/account-menu";
import { CurrencySwitcher } from "./currency-switcher";
import { isSwitchable, type CurrencyConfig } from "../data/currency-config";
import { MobileAccountLinks } from "../account/mobile-account-links";
import type { Category } from "../data/types";

/**
 * The shop's own nav — not the marketing header with a cart bolted on. It
 * carries categories, search, the cart and an account link, none of which
 * belong on the marketing site.
 *
 * `"use client"` because it holds the mobile search disclosure's open state
 * and reads the live cart count from `useCart()`. The mobile category menu's
 * own open state lives inside `Sheet` itself — uncontrolled, since nothing
 * here needs to react to it beyond what `SheetClose` already handles.
 */

const MOBILE_SEARCH_ID = "shop-nav-mobile-search";

const LINK_FOCUS =
  "rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const SHEET_LINK =
  "flex items-center gap-2 px-2 py-2.5 text-sm font-medium text-foreground hover:bg-brand-soft hover:text-brand";

function CategoryLink({ category }: { category: Category }) {
  return (
    <Link
      href={`/store/${category.slug}`}
      className={cn(
        "text-sm font-medium text-foreground/70 transition-colors hover:text-brand motion-reduce:transition-none",
        LINK_FOCUS,
      )}
    >
      {category.name}
    </Link>
  );
}

function SearchForm({
  id,
  className,
  autoFocus,
}: {
  id: string;
  className?: string;
  autoFocus?: boolean;
}) {
  return (
    <form
      action="/store/all"
      method="GET"
      role="search"
      className={cn("flex items-center gap-1.5", className)}
    >
      <Input
        id={id}
        type="search"
        name="q"
        placeholder="Search filament"
        aria-label="Search products"
        autoFocus={autoFocus}
        className="min-w-0 flex-1"
      />
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        aria-label="Search"
        className="shrink-0 focus-visible:ring-brand focus-visible:ring-offset-background"
      >
        <Search aria-hidden="true" className="h-4 w-4" />
      </Button>
    </form>
  );
}

function CartButton() {
  const cart = useCart();
  const showBadge = cart.hydrated && cart.itemCount > 0;
  const label = showBadge
    ? `Cart, ${cart.itemCount} item${cart.itemCount === 1 ? "" : "s"}`
    : "Cart";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={cart.open}
      aria-label={label}
      className="relative focus-visible:ring-brand focus-visible:ring-offset-background"
    >
      <ShoppingCart aria-hidden="true" className="h-5 w-5" />
      {showBadge && (
        <span
          aria-hidden="true"
          className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 font-mono text-[10px] font-semibold leading-none text-brand-ink"
        >
          {cart.itemCount}
        </span>
      )}
    </Button>
  );
}

function MobileMenu({
  categories,
  currencyConfig,
}: {
  categories: Category[];
  currencyConfig: CurrencyConfig;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Menu"
          className="md:hidden focus-visible:ring-brand focus-visible:ring-offset-background"
        >
          <Menu aria-hidden="true" className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="flex flex-col gap-0 overflow-hidden p-0">
        <SheetHeader className="border-b border-brand-line px-6 py-5 text-left">
          <SheetTitle>Menu</SheetTitle>
          <SheetDescription className="sr-only">
            Browse filament categories and your account.
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1">
          <nav aria-label="Shop menu" className="px-4 py-5">
            <ul className="flex flex-col gap-1">
              {categories.map((category) => (
                <li key={category.slug}>
                  <SheetClose asChild>
                    <Link href={`/store/${category.slug}`} className={cn(SHEET_LINK, LINK_FOCUS)}>
                      {category.name}
                    </Link>
                  </SheetClose>
                </li>
              ))}
            </ul>
            <Separator className="my-4" />
            {/* THE SAME ACTIONS AS THE DROPDOWN, laid out for touch rather than
                nested in one. A sheet that is already a list should not open a
                second list inside itself. */}
            <MobileAccountLinks linkClassName={cn(SHEET_LINK, LINK_FOCUS)} />
            {/* ═══ THE SWITCHER'''S ONLY HOME BELOW `sm` ═══
                The header row is four controls wide on a phone already, so the
                switcher is `hidden sm:flex` up there and lives here instead —
                a shopper on a phone must still be able to choose a currency
                before their first add, because a cart'''s currency is written at
                creation and cannot be changed afterwards. Renders nothing when
                the shop offers one currency, exactly as the header copy does,
                so the separator above it is not left hanging over an empty
                block. */}
            {isSwitchable(currencyConfig) && (
              <>
                <Separator className="my-4" />
                <p className="px-2 pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Currency
                </p>
                <SheetClose asChild>
                  <CurrencySwitcher config={currencyConfig} className="mx-2 w-fit" />
                </SheetClose>
              </>
            )}
          </nav>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

/**
 * CATEGORIES ARRIVE AS A PROP, NOT FROM A FETCH IN HERE.
 *
 * This is a client component — it holds the mobile menu's open state and reads
 * the live cart count — and a client component cannot `await` the catalogue. It
 * used to call `listCategories()` directly, which worked only while that was a
 * synchronous read of a local array.
 *
 * Fetching them in the browser instead would be worse in two ways: it would put
 * the nav's contents behind a round trip the server had already made, and it
 * would need CORS on an endpoint that has no reason to allow it. `ShopShell`
 * fetches once on the server and passes them down.
 */
export interface ShopNavProps {
  categories: Category[];
  /* Fetched by `ShopShell` on the server, for the reason the comment above
     gives for the categories. `CurrencySwitcher` renders nothing at all when
     this lists a single currency, which is every deploy until an operator
     enables dollars. */
  currencyConfig: CurrencyConfig;
}

export function ShopNav({ categories, currencyConfig }: ShopNavProps) {
  const [mobileSearchOpen, setMobileSearchOpen] = React.useState(false);

  return (
    <header data-print-hide className="sticky top-0 z-40 border-b border-brand-line bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-4 lg:gap-6">
          <MobileMenu categories={categories} currencyConfig={currencyConfig} />

          <Link
            href="/store"
            aria-label="PlaSpool store home"
            className={cn("shrink-0", LINK_FOCUS)}
          >
            <BrandLogo variant="lockup" tone="light" className="h-6 w-auto md:h-7 lg:h-8" />
          </Link>

          <nav aria-label="Shop categories" className="hidden md:block">
            <ul className="flex items-center gap-3 lg:gap-6">
              {categories.map((category) => (
                <li key={category.slug} className="whitespace-nowrap">
                  <CategoryLink category={category} />
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* Between `md` and `xl` the six category names already fill the row,
            so the full search input and the account label wait for `xl`; a
            compact icon toggle covers search below that, the same as it
            does on mobile. */}
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <SearchForm id="shop-search-desktop" className="hidden xl:flex xl:w-64" />

          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Search"
            aria-expanded={mobileSearchOpen}
            aria-controls={MOBILE_SEARCH_ID}
            onClick={() => setMobileSearchOpen((open) => !open)}
            className="xl:hidden focus-visible:ring-brand focus-visible:ring-offset-background"
          >
            <Search aria-hidden="true" className="h-5 w-5" />
          </Button>

          {/* BEFORE THE CART, DELIBERATELY. The currency has to be chosen
              before the first item is added — a cart's currency is written at
              creation and never updated — so the control that sets it sits on
              the side of the basket a shopper reaches first. Hidden below
              `sm`, where the row is already four controls wide; the mobile
              menu carries it instead. */}
          <CurrencySwitcher config={currencyConfig} className="hidden sm:flex" />

          <CartButton />
          {/* AT EVERY WIDTH. It was `hidden md:inline-flex`, so below 768px a shopper
            could not tell whether they were signed in without opening a
            hamburger shared with category browsing — and the sheet re-probed
            the session on every open, flashing "Sign in" at somebody who was
            not. Identity belongs in the header on a phone exactly as it does on
            a desktop; the slot is icon-width until `xl`, so it costs one 40px
            control. */}
          <AccountMenu />
        </div>
      </div>

      {mobileSearchOpen && (
        <div id={MOBILE_SEARCH_ID} className="border-t border-brand-line px-4 py-3 xl:hidden">
          <SearchForm id="shop-search-mobile" autoFocus />
        </div>
      )}
    </header>
  );
}
