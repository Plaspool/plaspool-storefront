"use client"
import { ArrowLeft, Clock, Globe, Package, Shield, Truck } from "lucide-react"

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@plaspool/ui"

export default function ShippingPolicy() {
  return (
    <div className="min-h-screen bg-muted font-mono">
      {/* Navigation */}
   

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-brand via-brand to-brand-hover text-white overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGZpbGw9IiMxMTEiIGQ9Ik0wIDBoNjB2NjBIMHoiLz48cGF0aCBkPSJNMzAgMzBoMzB2MzBIMzB6IiBzdHJva2U9IiMzMzMiIHN0cm9rZS13aWR0aD0iLjUiLz48cGF0aCBkPSJNMCAzMGgzMHYzMEgweiIgc3Ryb2tlPSIjMzMzIiBzdHJva2Utd2lkdGg9Ii41Ii8+PC9nPjwvc3ZnPg==')] bg-[size:60px_60px] opacity-10" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24 text-center">
          <div className="space-y-6">
            <Badge
              variant="secondary"
              className="bg-brand/40 text-brand-ink border-brand-line/30 font-mono text-xs tracking-wider"
            >
              Shipping & Returns Policy
            </Badge>
            <h1 className="text-4xl lg:text-5xl font-bold leading-tight tracking-tight">
              Shipping & Returns
              <span className="text-brand-ink"> Policy</span>
            </h1>
            
          </div>
        </div>
      </section>



      {/* Shipping Information */}
      <section className="py-16 bg-muted">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-12">
            {/* Shipping Coverage */}
            <Card className="border-0 shadow-lg bg-brand">
              <CardHeader>
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-brand-soft rounded-lg flex items-center justify-center">
                    <span className="text-brand font-bold font-mono">1</span>
                  </div>
                  <div>
                    <CardTitle className="text-xl tracking-tight">Shipping Coverage & Partners</CardTitle>
                    {/* <CardDescription>Our trusted logistics partners worldwide</CardDescription> */}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-brand-soft rounded-full flex items-center justify-center">
                        <Truck className="w-4 h-4 text-brand" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-brand-ink">Within Nigeria</h4>
                        <p className="text-sm text-brand-ink font-mono">
                          Orders shipped via <strong>GIG Logistics</strong> — trusted for safe local delivery
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-brand-soft rounded-full flex items-center justify-center">
                        <Globe className="w-4 h-4 text-brand" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-brand-ink">Africa & Worldwide</h4>
                        <p className="text-sm text-brand-ink font-mono">
                          International shipping with <strong>DHL Express</strong> for reliable door-to-door service
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Processing Time */}
            <Card className="border-0 shadow-lg bg-brand">
              <CardHeader>
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-brand-soft rounded-lg flex items-center justify-center">
                    <span className="text-brand font-bold font-mono">2</span>
                  </div>
                  <div>
                    <CardTitle className="text-xl tracking-tight">Processing Time</CardTitle>
                    <CardDescription>How quickly we prepare your order</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3 text-brand-ink font-mono text-sm">
                  <li className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-brand rounded-full mt-2"></div>
                    <span>
                      All orders are processed within <strong>1–2 business days</strong> after payment confirmation
                    </span>
                  </li>
                  <li className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-brand rounded-full mt-2"></div>
                    <span>Orders placed on weekends or public holidays are handled on the next business day</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Shipping Rates & Delivery */}
            <Card className="border-0 shadow-lg bg-brand">
              <CardHeader>
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-brand-soft rounded-lg flex items-center justify-center">
                    <span className="text-brand font-bold font-mono">3</span>
                  </div>
                  <div>
                    <CardTitle className="text-xl tracking-tight">Shipping Rates & Delivery Time</CardTitle>
                    <CardDescription>Costs and delivery timeframes</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg p-4 space-y-3">
                  <p className="font-mono text-sm text-brand-ink">
                    <strong>Shipping costs</strong> are calculated at checkout based on destination and weight
                  </p>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h4 className="font-semibold text-brand-ink">Domestic Delivery</h4>
                      <p className="text-sm text-brand-ink font-mono">2–5 business days</p>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-semibold text-brand-ink">International Delivery</h4>
                      <p className="text-sm text-brand-ink font-mono">
                        5–10 business days, depending on location and customs processing
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tracking */}
            <Card className="border-0 shadow-lg bg-brand">
              <CardHeader>
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-brand-soft rounded-lg flex items-center justify-center">
                    <span className="text-brand font-bold font-mono">4</span>
                  </div>
                  <div>
                    <CardTitle className="text-xl tracking-tight">Tracking</CardTitle>
                    <CardDescription>Monitor your package every step of the way</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="font-mono text-sm text-brand-ink">
                  Once shipped, you&apos;ll receive a <strong>tracking number via email</strong> to monitor your parcel
                </p>
              </CardContent>
            </Card>

            {/* Delays & Issues */}
            <Card className="border-0 shadow-lg bg-brand">
              <CardHeader>
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-brand-soft rounded-lg flex items-center justify-center">
                    <span className="text-brand font-bold font-mono">5</span>
                  </div>
                  <div>
                    <CardTitle className="text-xl tracking-tight">Delays & Issues</CardTitle>
                    <CardDescription>What to do if there are shipping delays</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3 font-mono text-sm">
                  <li className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-brand-ink rounded-full mt-2 text-brand-ink"></div>
                    <span className="text-brand-ink">
                      While we and our partners strive for timely delivery, delays may occur due to weather, customs, or
                      unforeseen events
                    </span>
                  </li>
                  <li className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-brand-ink rounded-full mt-2"></div>
                    <span className="text-brand-ink">
                      If your order hasn&apos;t arrived within the estimated time, please contact us at{" "}
                      <strong>[hello@plaspool.com]</strong>
                    </span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Lost or Damaged */}
            <Card className="border-0 shadow-lg bg-brand">
              <CardHeader>
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-brand-soft rounded-lg flex items-center justify-center">
                    <span className="text-brand font-bold font-mono">6</span>
                  </div>
                  <div>
                    <CardTitle className="text-xl tracking-tight">Lost or Damaged Packages</CardTitle>
                    <CardDescription>We&apos;ll make it right</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3 font-mono text-sm text-brand-ink">
                  <li className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-brand-ink rounded-full mt-2"></div>
                    <span>If your package is lost or arrives damaged, notify us immediately</span>
                  </li>
                  <li className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-brand-ink rounded-full mt-2"></div>
                    <span>We&apos;ll work with GIG or DHL to investigate and resolve the issue as quickly as possible</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Returns & Refunds */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-3xl font-bold text-foreground tracking-tight">Returns & Refunds</h2>
            <p className="text-lg text-muted-foreground">Simple, straightforward return process</p>
          </div>

          <div className="space-y-8">
            {/* Returns */}
            <Card className="border-0 shadow-lg bg-brand">
              <CardHeader>
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-brand-soft rounded-lg flex items-center justify-center">
                    <span className="text-brand font-bold font-mono">7</span>
                  </div>
                  <div>
                    <CardTitle className="text-xl tracking-tight">Returns</CardTitle>
                    <CardDescription>7-day return window</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3 font-mono text-sm text-brand-ink">
                  <li className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-brand rounded-full mt-2"></div>
                    <span>
                      We accept returns within <strong>7 days of delivery</strong> if the product is unused and in its
                      original packaging
                    </span>
                  </li>
                  <li className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-brand rounded-full mt-2"></div>
                    <span>
                      To start a return, contact us at <strong>[support email]</strong> with your order number and
                      reason for return
                    </span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Refunds */}
            <Card className="border-0 shadow-lg bg-brand">
              <CardHeader>
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-brand-soft rounded-lg flex items-center justify-center">
                    <span className="text-brand font-bold font-mono">8</span>
                  </div>
                  <div>
                    <CardTitle className="text-xl tracking-tight">Refunds</CardTitle>
                    <CardDescription>Quick refund processing</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3 font-mono text-sm text-brand-ink">
                  <li className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-brand rounded-full mt-2"></div>
                    <span>
                      Once we receive and inspect your returned item, we&apos;ll notify you of approval or rejection
                    </span>
                  </li>
                  <li className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-brand rounded-full mt-2"></div>
                    <span>
                      Approved refunds are processed to your original payment method within{" "}
                      <strong>5–10 business days</strong>
                    </span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Exchanges */}
            <Card className="border-0 shadow-lg bg-brand">
              <CardHeader>
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-brand-soft rounded-lg flex items-center justify-center">
                    <span className="text-brand font-bold font-mono">9</span>
                  </div>
                  <div>
                    <CardTitle className="text-xl tracking-tight">Exchanges</CardTitle>
                    <CardDescription>Need a different product?</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="font-mono text-sm text-brand-ink">
                  Need an exchange? Reach out within <strong>7 days</strong>. We&apos;ll guide you through it.
                </p>
              </CardContent>
            </Card>

            {/* Return Shipping */}
            <Card className="border-0 shadow-lg bg-brand">
              <CardHeader>
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-brand-soft rounded-lg flex items-center justify-center">
                    <span className="text-brand font-bold font-mono">10</span>
                  </div>
                  <div>
                    <CardTitle className="text-xl tracking-tight">Return Shipping</CardTitle>
                    <CardDescription>Who pays for return shipping</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="font-mono text-sm text-brand-ink">
                  Customers are responsible for return shipping costs unless the return is due to our error (wrong item,
                  defective product, etc.).
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-16 bg-gradient-to-r from-brand to-brand-hover text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
          <div className="space-y-4">
            <h2 className="text-3xl font-bold tracking-tight">📨 Questions?</h2>
            <p className="text-xl text-brand-ink font-mono">
              Email us anytime at <strong>hello@plaspool.com</strong> — we&apos;re here to help.
            </p>
          </div>
          
        </div>
      </section>

     
    </div>
  )
}
