
"use client"
import Image from "next/image"
import { ArrowRight, Globe, Layers, Shield, Truck, Users, Zap } from "lucide-react"

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@plaspool/ui"
import Link from "next/link"

export default function PlaspoolLanding() {
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
                <p className="text-xl text-brand-ink leading-relaxed font-light">
                  Engineered for excellence. Manufactured with precision. Delivered globally. PlaSpool provides
                  high-quality PLA filaments for makers, professionals, and industrial users worldwide.
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
                    it correctly on an inverted band is `default`. */}
                <Button asChild size="lg" tone="default" className="font-mono">
                  <Link href="/store" prefetch={false}>
                    Shop Filaments <ArrowRight className="ml-2 w-4 h-4" />
                  </Link>
                </Button>
                <a href="#specs">
                <Button
                  size="lg"
                  variant="outline"
                  /* OUTLINE, NOT A SECOND SOLID BRAND BUTTON. This sits beside
                     "Shop Filaments" on the dark hero and was a muted secondary
                     (`bg-slate-800` against the primary's `bg-blue-800`). Mapping
                     both fills onto `bg-brand` made two identical CTAs with no
                     hierarchy between them, so the fill comes off and the border
                     carries it — which is what `variant="outline"` meant here.

                     `tone="none"` — THE ONE PLACE THE TREATMENT DOES NOT REACH.
                     A second white machined key here would erase the hierarchy
                     the comment above exists to protect, and the machined table
                     has no inverted row to be quiet in: it is light-ground by
                     construction, its top highlight assumes light falling onto
                     a light page. So this stays a hand-drawn outline on the
                     dark band. It is NOT excused from the flag — there is no
                     flag position in which a bevel belongs here. */
                  tone="none"
                  className="border-brand-line bg-transparent text-brand-ink hover:bg-brand-hover hover:text-brand-ink font-mono"
                >
                  View Specifications
                </Button></a>
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

          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow bg-white">
              <CardHeader className="text-center pb-4">
                <div className="w-16 h-16 bg-brand-soft rounded-full flex items-center justify-center mx-auto mb-4">
                  <Layers className="w-8 h-8 text-brand" />
                </div>
                <CardTitle className="text-xl text-muted-foreground tracking-tight">PLA Filaments</CardTitle>
                <CardDescription>Easy-to-print, biodegradable, perfect for beginners and pros alike</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 font-mono">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Diameter Tolerance</span>
                    <span className="text-foreground font-medium">±0.02mm</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Print Temperature</span>
                    <span className="text-foreground font-medium">190-220°C</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Bed Temperature</span>
                    <span className="text-foreground font-medium">50-60°C</span>
                  </div>
                </div>
                
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow bg-white">
              <CardHeader className="text-center pb-4">
                <div className="w-16 h-16 bg-brand-soft rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-brand" />
                </div>
                <CardTitle className="text-xl tracking-tight text-muted-foreground">For Everyone</CardTitle>
                <CardDescription>From individual makers to businesses in need of bulk supply</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm text-muted-foreground font-mono">
                  <li>Individual makers & hobbyists</li>
                  <li>Educational institutions</li>
                  <li>Professional and Industrial prototyping</li>
                </ul>
                
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow bg-white">
              <CardHeader className="text-center pb-4">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-8 h-8 text-muted-foreground" />
                </div>
                <CardTitle className="text-xl tracking-tight text-muted-foreground">Quality Control</CardTitle>
                <CardDescription>Strict quality controls ensure consistent performance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm text-muted-foreground font-mono">
                  <li>Uniform diameter control</li>
                  <li>Batch quality tracking</li>
                  <li>Performance validation</li>
                </ul>
          
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

        <section id="specs" className="py-16 bg-muted">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-12">
            <Badge variant="outline" className="text-brand border-brand-line font-mono text-xs tracking-wider">
              Technical Data
            </Badge>
            <h2 className="text-3xl font-bold text-foreground tracking-tight">Engineering Specifications</h2>
          </div>

          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-brand-line">
                <thead className="bg-muted">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider font-mono"
                    >
                      Property
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider font-mono"
                    >
                      Value
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider font-mono"
                    >
                      Test Method
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-brand-line font-mono text-sm">
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-foreground">Diameter Tolerance</td>
                    <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">±0.02mm</td>
                    <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">Laser Micrometer</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-foreground">Roundness</td>
                    <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">≥ 95%</td>
                    <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">Optical Measurement</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-foreground">Tensile Strength</td>
                    <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">50 MPa</td>
                    <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">ASTM D638</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-foreground">Print Temperature</td>
                    <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">190-220°C</td>
                    <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">Thermal Analysis</td>
                  </tr>
                </tbody>
              </table>
            </div>
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

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-brand-soft rounded-full flex items-center justify-center mx-auto">
                <Globe className="w-8 h-8 text-brand" />
              </div>
              <h3 className="font-semibold text-foreground tracking-wide">Africa</h3>
              <p className="text-sm text-muted-foreground">Serving the growing African maker community</p>
            </div>
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-brand-soft rounded-full flex items-center justify-center mx-auto">
                <Globe className="w-8 h-8 text-brand" />
              </div>
              <h3 className="font-semibold text-foreground tracking-wide">Europe</h3>
              <p className="text-sm text-muted-foreground">Reliable supply to European markets</p>
            </div>
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-brand-soft rounded-full flex items-center justify-center mx-auto">
                <Globe className="w-8 h-8 text-brand" />
              </div>
              <h3 className="font-semibold text-foreground tracking-wide">North America</h3>
              <p className="text-sm text-muted-foreground">Fast delivery across the Americas</p>
            </div>
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
                <Globe className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-foreground tracking-wide">Asia & Beyond</h3>
              <p className="text-sm text-muted-foreground">Expanding reach to global markets</p>
            </div>
          </div>

          <div className="bg-muted rounded-2xl p-8" id="partnerships">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div className="space-y-6">
                <h3 className="text-2xl font-bold text-foreground tracking-tight">Partnership Opportunities</h3>
                <p className="text-muted-foreground">
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

      {/* Technical Specifications */}
    

      {/* ═══ WHY THIS IS ON THE HOME PAGE AND NOT ONLY IN /privacy ═══

          Google's OAuth verification reads the page submitted as the app's
          home page and looks for an explanation of what user data the app
          asks for and why. A link to the privacy policy is required too, but
          it is not what THAT check is satisfied by — the explanation has to be
          on the page, readable by a signed-out visitor.

          PlaSpool offers "Continue with Google" on /sign-in, so the answer
          belongs here. Deleting this section, or putting it behind a sign-in,
          puts the app's Google verification back where it was in August 2026:
          rejected. Keep it in step with /privacy — the two must not disagree
          about what Google sends us. */}
      <section id="accounts" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-16">
            <Badge variant="outline" className="text-brand border-brand-line font-mono text-xs tracking-wider">
              Accounts &amp; Privacy
            </Badge>
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground tracking-tight">Your PlaSpool Account</h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Browse the catalogue and check out without an account if you prefer. Create one and PlaSpool keeps your
              order history, delivery updates and returns in one place — signed in with your email address, or with
              your Google Account.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-start">
            <Card className="border-brand-line">
              <CardHeader className="space-y-4">
                <div className="w-12 h-12 bg-brand-soft rounded-full flex items-center justify-center">
                  <Users className="w-6 h-6 text-brand" />
                </div>
                <CardTitle className="text-foreground tracking-tight">Signing in with Google</CardTitle>
                <CardDescription>
                  Choosing <strong className="text-foreground">Continue with Google</strong> asks for your permission
                  first. Google then sends us the basic profile on your Google Account: your name, your email address,
                  your profile picture and your Google account identifier.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p className="font-semibold text-foreground">We use it for one thing — running your account:</p>
                <ul className="space-y-2 list-disc pl-5">
                  <li>creating your account, and signing you back in on later visits;</li>
                  <li>attaching your orders to you, so your history, delivery status and returns are there;</li>
                  <li>contacting you about an order you have placed.</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-brand-line">
              <CardHeader className="space-y-4">
                <div className="w-12 h-12 bg-brand-soft rounded-full flex items-center justify-center">
                  <Shield className="w-6 h-6 text-brand" />
                </div>
                <CardTitle className="text-foreground tracking-tight">What we never ask for</CardTitle>
                <CardDescription>
                  That basic profile is the whole of it. Nothing else about your Google Account is visible to us.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <ul className="space-y-2 list-disc pl-5">
                  <li>No access to Gmail, Drive, Contacts, Calendar or Photos — we cannot read any of them.</li>
                  <li>Your Google password is never shared with us. Google performs the sign-in itself.</li>
                  <li>We never sell your information, and never use it for advertising or profiling.</li>
                  <li>Your card details never reach us — payment happens on Paystack&apos;s own page.</li>
                </ul>
                <p className="pt-2">
                  You can disconnect PlaSpool from your Google Account whenever you like, and ask us to delete your
                  PlaSpool account entirely.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="text-center mt-12">
            <Button asChild variant="outline" className="font-mono">
              <Link href="/privacy">
                Read our privacy policy <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-r from-brand to-brand-hover text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
          <h2 className="text-3xl lg:text-4xl font-bold tracking-tight">Ready to Experience PlaSpool Quality?</h2>
          <p className="text-xl text-brand-ink">
            Whether you are printing prototypes, functional parts, or artistic models, PlaSpool delivers reliable
            filament that performs consistently.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {/* One anchor styled as a button — see the hero CTA above. */}
            {/* `default` for the same reason as the hero CTA above: this band
                is brand-painted, and the white key is the readable one on it.
                The button was already white — it just says so as a role now. */}
            <Button asChild size="lg" tone="default" className="w-full font-mono">
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
