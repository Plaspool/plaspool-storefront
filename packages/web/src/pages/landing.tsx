
"use client"
import Image from "next/image"
import { ArrowRight, Layers, Recycle, Shield, Truck, Users, Zap } from "lucide-react"

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@plaspool/ui"
import { programOffer, programOpening, type RewardsProgram } from "@plaspool/shop"
import Link from "next/link"

export interface PlaspoolLandingProps {
  /**
   * The live rewards programme, or null when none is configured.
   *
   * ═══ A PROP, BECAUSE THIS FILE IS `"use client"` AND THE PROGRAMME IS A
   * SERVER READ ═══
   * `getRewardsProgram()` is an `async` fetch with a `next: { revalidate }`
   * entry; it cannot run here. The host route (`app/(site)/page.tsx`) is a
   * server component, so it awaits the programme and hands the plain object
   * down — the same shape `RewardsBand` reads directly on `/store`.
   *
   * NULLABLE ON PURPOSE, AND THE CARD DISAPPEARS WITH IT. `getRewardsProgram`
   * answers null rather than throwing when the marketing API is unreachable,
   * and the rule the whole storefront follows is that a section explaining a
   * scheme that does not exist is worse than a shorter page. A marketing
   * outage costs this one card and nothing else on the landing page.
   */
  program?: RewardsProgram | null
}

export default function PlaspoolLanding({ program = null }: PlaspoolLandingProps) {
  return (
    <div className="min-h-screen bg-muted font-mono">


      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-brand via-brand to-brand-hover text-white overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGZpbGw9IiMxMTEiIGQ9Ik0wIDBoNjB2NjBIMHoiLz48cGF0aCBkPSJNMzAgMzBoMzB2MzBIMzB6IiBzdHJva2U9IiMzMzMiIHN0cm9rZS13aWR0aD0iLjUiLz48cGF0aCBkPSJNMCAzMGgzMHYzMEgweiIgc3Ryb2tlPSIjMzMzIiBzdHJva2Utd2lkdGg9Ii41Ii8+PC9nPjwvc3ZnPg==')] bg-[size:60px_60px] opacity-10" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="space-y-4">
                <Badge
                  variant="secondary"
                  className="bg-brand/40 text-brand-ink border-brand-line/30 font-mono text-xs tracking-wider"
                >
                  Precision Engineering
                </Badge>
                <h1 className="text-4xl lg:text-6xl font-bold leading-tight tracking-tight">
                  Premium 3D Printer
                  <span className="text-brand-ink"> Filaments</span>
                </h1>
                {/* NOT `font-light`. A 300 weight at this size was the thinnest
                    text on the page sitting on the darkest ground on the page,
                    which is the pairing this pass exists to stop. */}
                <p className="text-xl text-brand-ink leading-relaxed">
                  High-quality PLA filaments for makers, professionals and industrial users in Nigeria —
                  engineered for excellence and manufactured with precision.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                {/* `asChild` so this renders ONE anchor styled as a button.
                    It was a <Button> nested inside an <a>, which is invalid
                    HTML and breaks keyboard activation — the same trap
                    `nav.tsx` documents beside its own CTA. */}
                {/* `default`, NOT `primary`, AND THE HERO IS WHY. The machined
                    table is built for a light ground (see `machined.css`), so
                    its `primary` row is a #303030 key — which against this
                    section's #231c50 gradient measures about 1.1:1 and fails
                    SC 1.4.11's 3:1 for a control boundary outright. The white
                    key is 15.5:1 here and is unmistakably the page's one call
                    to action. The ROLE is still primary; the TONE that renders
                    it correctly on an inverted band is `default`.

                    IT IS ALSO NOW THE ONLY BUTTON HERE. "View Specifications"
                    stood beside it and pointed at the `#specs` table, and both
                    were removed together — that button was the section's only
                    inbound link, so neither outlives the other. */}
                <Button asChild size="lg" tone="default" className="font-mono">
                  <Link href="/store" prefetch={false}>
                    Shop Filaments <ArrowRight className="ml-2 w-4 h-4" />
                  </Link>
                </Button>
              </div>
              
            </div>
            <div className="relative">
              <div className="aspect-square bg-gradient-to-br from-brand/20 to-brand-hover/20 rounded-3xl p-8 backdrop-blur-sm border border-white/10">
                <Image
                  src="/filament_cta2.jpg"
                  alt="3D Printer Filament Spools"
                  width={2000}
                  height={1300}
                  className="w-full h-full object-cover rounded-2xl"
                />
              </div>
              <div className="absolute -top-4 -right-4 w-24 h-24 bg-brand-hover/30 rounded-full blur-xl" />
              <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-brand/30 rounded-full blur-xl" />

              {/* Technical blueprint overlay */}
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBzdHJva2U9IiM0QjgzRkYiIHN0cm9rZS13aWR0aD0iLjUiIG9wYWNpdHk9Ii4yIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0MCIvPjxjaXJjbGUgY3g9IjUwIiBjeT0iNTAiIHI9IjIwIi8+PGxpbmUgeDE9IjIwIiB5MT0iNTAiIHgyPSI4MCIgeTI9IjUwIi8+PGxpbmUgeDE9IjUwIiB5MT0iMjAiIHgyPSI1MCIgeTI9IjgwIi8+PC9nPjwvc3ZnPg==')] bg-no-repeat bg-center opacity-20" />
            </div>
          </div>
        </div>
      </section>

      {/* Who We Are */}
      <section id="about" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <div className="space-y-4">
                <Badge variant="outline" className="text-brand border-brand-line font-mono text-xs tracking-wider">
                  Who We Are
                </Badge>
                <h2 className="text-3xl lg:text-4xl font-bold text-foreground tracking-tight">
                  West Africa’s First 3D Printing Filament Producer
                </h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Based in Abuja, Nigeria, PlaSpool specializes in manufacturing high-quality 3D printer filaments for
                  makers, professionals, and industrial users alike. We combine local expertise with global standards to
                  deliver materials that perform consistently, every time.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Shield className="w-8 h-8 text-brand" />
                  <h3 className="font-semibold text-foreground tracking-wide">Quality Assured</h3>
                  <p className="text-sm text-muted-foreground">
                    Strict quality controls ensure uniform diameter and smooth extrusion
                  </p>
                </div>
                <div className="space-y-2">
                  <Zap className="w-8 h-8 text-brand" />
                  <h3 className="font-semibold text-foreground tracking-wide">Innovation Driven</h3>
                  <p className="text-sm text-muted-foreground">
                    Cutting-edge manufacturing processes for superior performance
                  </p>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="aspect-[4/3] bg-muted rounded-2xl overflow-hidden">
                <Image
                  src="/filament_cta1.jpg"
                  alt="PlaSpool Manufacturing Facility"
                  width={2000}
                  height={1300}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-brand/20 to-transparent rounded-2xl" />

              {/* Technical measurement overlay */}
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iLjUiIG9wYWNpdHk9Ii4xIj48cGF0aCBkPSJNMCAwaDEwMHYxMDBIMHoiLz48cGF0aCBkPSJNMjUgMHYxMDBNNTAgMHYxMDBNNzUgMHYxMDBNMCAyNWgxMDBNMCA1MGgxMDBNMCA3NWgxMDAiLz48L2c+PC9zdmc+')] bg-[size:50px_50px] opacity-10" />
            </div>
          </div>
        </div>
      </section>

      {/* What We Do */}
      <section id="products" className="py-24 bg-muted">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-16">
            <Badge variant="outline" className="text-brand border-brand-line font-mono text-xs tracking-wider">
              What We Do
            </Badge>
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground tracking-tight">Engineered for Excellence</h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              PlaSpool is a filament manufacturer focused on providing top-tier 3D printing materials. Currently
              specializing in PLA filaments with plans for expansion.
            </p>
          </div>

          {/* ═══ THE COLUMN COUNT FOLLOWS THE CARD COUNT ═══
              Three cards on a three-column grid; four when the rewards card is
              there. Both class strings are written out in full rather than
              interpolated — Tailwind's scanner reads source text, and a class
              assembled at runtime is one it never sees and never generates.

              FOUR ACROSS ONLY AT `xl`. At `lg` the container is 960px wide, so
              a quarter of it is a 216px card — narrower than any card on the
              site and too narrow for the paragraph the rewards card carries.
              2×2 from `md` to `xl` gives 344–576px, and 4-up at `xl` gives
              280px, which is the width these cards were drawn at. */}
          <div
            className={
              program
                ? "grid gap-8 mb-16 md:grid-cols-2 xl:grid-cols-4"
                : "grid gap-8 mb-16 md:grid-cols-3"
            }
          >
            {/* ═══ TOP-ALIGNED, LIKE ALL FOUR — THIS WAS BRIEFLY CENTRED AND
                IT WAS WRONG ═══
                Losing the spec table left this card shorter than its
                siblings, and `flex flex-col justify-center` was an attempt to
                make the leftover space read as deliberate. Seen in the row it
                did the opposite: three medallions on one line and a fourth
                150px below them, which is a misalignment the eye catches
                before it reads a single word.

                Empty space at the BOTTOM of a short card is what every card
                grid looks like. A row of icons that do not line up is not. */}
            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow bg-white">
              <CardHeader className="text-center pb-4">
                <div className="w-16 h-16 bg-brand-soft rounded-full flex items-center justify-center mx-auto mb-4">
                  <Layers className="w-8 h-8 text-brand" />
                </div>
                <CardTitle className="text-xl text-foreground tracking-tight">PLA Filaments</CardTitle>
                <CardDescription>Easy-to-print, biodegradable, perfect for beginners and pros alike</CardDescription>
              </CardHeader>
              {/* NO `CardContent`. This card carried a three-row spec table —
                  diameter tolerance, print temperature, bed temperature — and
                  those figures belong to a PRODUCT, not to the range: they are
                  on every listing and on the product page's parameters tab,
                  where they move with the item. Quoted on the landing page
                  they were a claim about whatever PlaSpool happens to sell
                  next, maintained nowhere.

                  The empty `<CardContent className="space-y-4">` they lived in
                  went with them rather than being left behind as 24px of
                  padding around nothing. The grid stretches its cards to a
                  common height, so this one is shorter in content and the same
                  size on the page. */}
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow bg-white">
              <CardHeader className="text-center pb-4">
                <div className="w-16 h-16 bg-brand-soft rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-brand" />
                </div>
                <CardTitle className="text-xl tracking-tight text-foreground">For Everyone</CardTitle>
                <CardDescription>From individual makers to businesses in need of bulk supply</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* `text-center`, MATCHING THE HEADER ABOVE IT. Every card in
                    this row centres its medallion, title and description and
                    then dropped to a left-aligned body — one card, two
                    alignments, and a ragged left edge starting halfway down.
                    All four bodies are centred now; the row reads as one
                    column of text per card instead of two. */}
                <ul className="space-y-2 text-sm text-muted-foreground font-mono text-center">
                  <li>Individual makers & hobbyists</li>
                  <li>Educational institutions</li>
                  <li>Professional and Industrial prototyping</li>
                </ul>
                
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow bg-white">
              <CardHeader className="text-center pb-4">
                {/* `bg-brand-soft`/`text-brand`, matching the two cards beside
                    it. The muted pair here made the third card read as disabled
                    — a state, not the emphasis it was reaching for. */}
                <div className="w-16 h-16 bg-brand-soft rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-8 h-8 text-brand" />
                </div>
                <CardTitle className="text-xl tracking-tight text-foreground">Quality Control</CardTitle>
                <CardDescription>Strict quality controls ensure consistent performance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Centred, for the reason on the card before this one. */}
                <ul className="space-y-2 text-sm text-muted-foreground font-mono text-center">
                  <li>Uniform diameter control</li>
                  <li>Batch quality tracking</li>
                  <li>Performance validation</li>
                </ul>

              </CardContent>
            </Card>

            {/* ═══ THE REWARDS CARD, AND NOT ONE WORD OF IT IS WRITTEN HERE ═══
                The programme's name, what a point is called and what a unit is
                called all come from `GET /api/public/marketing/rewards`, and
                both sentences are built by `programOpening`/`programOffer` in
                `@plaspool/shop` — the same two the return dialog's first step
                shows. An operator renaming "Spool Points" renames this card
                with it, and a rewrite of the offer lands on both surfaces at
                once. `data/marketing.ts` sets the rule out at length.

                RENDERS NOTHING WHEN THERE IS NO PROGRAMME — see the note on
                the `program` prop above.

                SHAPED EXACTLY LIKE ITS THREE NEIGHBOURS: same white card, same
                `bg-brand-soft` medallion, same `text-xl` title. The row is one
                set of things PlaSpool does, and a card that announced itself
                with a different fill would read as an ad dropped into it. What
                distinguishes this one is the figure at the bottom, which is
                the only number on the page a shopper can put in their pocket. */}
            {program && (
              <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow bg-white">
                <CardHeader className="text-center pb-4">
                  <div className="w-16 h-16 bg-brand-soft rounded-full flex items-center justify-center mx-auto mb-4">
                    <Recycle className="w-8 h-8 text-brand" />
                  </div>
                  <CardTitle className="text-xl tracking-tight text-foreground">
                    {program.pointsLabelPlural}
                  </CardTitle>
                  <CardDescription>{programOpening(program)}</CardDescription>
                </CardHeader>
                {/* ═══ NO VALUE PILL HERE. IT LIVES IN THE RETURN DIALOG ═══
                    A bordered, tinted, `text-xl` row was the only filled block
                    anywhere in this grid, and it sat at the bottom of the last
                    card — so the row ended on a weight nothing else carried
                    and the four cards stopped reading as a set. The dialog's
                    first step is where a shopper is actually deciding whether
                    to send spools back, and the figure earns its emphasis
                    there; here it was a fifth thing competing with three
                    quiet cards.

                    `POINT_VALUE_NAIRA` still exists and the dialog still shows
                    it — this card just does not repeat it. */}
                <CardContent>
                  <p className="text-sm text-muted-foreground font-mono leading-relaxed text-center">
                    {programOffer(program)}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </section>

      {/* Global Reach */}
      <section id="global" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-16">
            <Badge variant="outline" className="text-brand border-brand-line font-mono text-xs tracking-wider">
              Where We Operate
            </Badge>
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground tracking-tight">
              Global Reach from Abuja, Nigeria
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              PlaSpool operates globally from our base in Abuja, Nigeria. Our logistics partners ensure fast and safe
              delivery of your filament, no matter where you print.
            </p>
          </div>

          <div className="bg-muted rounded-2xl p-8" id="partnerships">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div className="space-y-6">
                <h3 className="text-2xl font-bold text-foreground tracking-tight">Partnership Opportunities</h3>
                <p className="text-lg text-muted-foreground">
                  We support partnerships with resellers, distributors, and educators worldwide. Join our global network
                  and bring premium filaments to your local market.
                </p>
                <div className="flex items-center space-x-4">
                  <Truck className="w-5 h-5 text-brand" />
                  <span className="text-sm text-muted-foreground font-mono">Fast & Safe Delivery</span>
                </div>
                <Link target="blank" href="https://docs.google.com/forms/d/e/1FAIpQLSenTtkWn7eUcv1npGgnYCWojXxJiwbF3FVLvxurB8fgWPjMmA/viewform?usp=dialog" className="inline-block">
                <Button className="font-mono">
                  Become a Partner <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
                </Link>
              </div>
              <div className="aspect-video bg-muted rounded-xl overflow-hidden">
                <Image
                  src="/worldwide.jpg"
                  alt="Global Shipping Network"
                  width={400}
                  height={300}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      {/* ═══ WHITE, AND THE FOOTER UNDERNEATH IT IS THE WHOLE REASON ═══
          This band was `from-brand to-brand-hover` sitting directly on the
          footer's flat `bg-brand`: two different purples meeting with no seam
          between them, which reads as a rendering fault rather than as two
          sections. Painting this one white gives the footer an edge to begin
          at, and lets the page end on ONE deliberate block of brand colour
          instead of two accidental ones.

          IT ALSO FLIPS THE BUTTON'S TONE, and that is not cosmetic. `default`
          is the machined table's WHITE key, chosen for this band precisely
          because the band used to be painted; left here it would be a white
          key on white. `primary` is the #303030 row the table is built for on
          a light ground — the hero CTA states the same rule from the other
          side, and the two comments should be read together. */}
      <section className="py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
          <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-foreground">
            Ready to Experience PlaSpool Quality?
          </h2>
          <p className="text-lg text-muted-foreground">
            Whether you are printing prototypes, functional parts, or artistic models, PlaSpool delivers reliable
            filament that performs consistently.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {/* One anchor styled as a button — see the hero CTA above. */}
            <Button asChild size="lg" tone="primary" className="w-full font-mono">
              <Link href="/store" prefetch={false}>
                Shop Now <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
            </Button>
            {/* <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10 font-mono">
              Request Samples
            </Button> */}
          </div>
        </div>
      </section>
    </div>
  )
}
