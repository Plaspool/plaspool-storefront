import { Container, Prose, Section } from "@plaspool/ui";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of service",
  description:
    "The terms on which PlaSpool sells 3D printing filament and operates this website.",
  alternates: { canonical: "/terms" },
};

export default function Page() {
  return (
    <Section>
      <Container>
        <Prose>
          <h1>Terms of service</h1>
          <p>
            <strong>Last updated:</strong> 14 August 2026
          </p>

          <h2>Agreement</h2>
          <p>
            These terms apply when you use this website or buy from PlaSpool. By
            placing an order you accept them. If you do not accept them, please do
            not order. We may update these terms; the version published here at the
            time of your order is the one that applies to it.
          </p>

          <h2>Orders and pricing</h2>
          <p>
            Prices are shown in Nigerian Naira and include any taxes stated at
            checkout. Delivery is charged separately unless stated otherwise. Listing
            a product on this site is an invitation to order, not a binding offer —
            your order is accepted when we confirm it. We may decline an order, for
            example where stock has run out or a price has been listed in error, and
            we will tell you and refund anything already paid.
          </p>

          <h2>Payment</h2>
          <p>
            Payment is taken through the methods offered at checkout. Orders are not
            dispatched until payment has cleared.
          </p>

          <h2>Delivery</h2>
          <p>
            We deliver nationwide within Nigeria. See our{" "}
            <a href="/shipping">shipping information</a> for how orders are sent.
          </p>
          <p>
            <strong>To be confirmed:</strong> our published dispatch and delivery
            timelines, and the delivery areas and charges that apply to each, have
            not yet been finalised. Until they are, the timings shown at checkout for
            your order are the ones that apply, and we make no wider promise about
            delivery speed on this page.
          </p>

          <h2>Returns and refunds</h2>
          <p>
            If an item arrives damaged, faulty, or is not what you ordered, contact us
            and we will put it right — by replacement or refund. Filament that has
            been opened or partly used cannot generally be resold, so we handle those
            cases individually.
          </p>
          <p>
            <strong>To be confirmed:</strong> the return window for unopened stock,
            whether a restocking fee applies and at what rate, and who pays return
            postage, are commercial terms that have not yet been set. We are not
            stating a figure here rather than state one we have not agreed. Until this
            section is completed, contact us and we will deal with your request
            individually and in good faith. Nothing in this section limits your rights
            under Nigerian consumer protection law.
          </p>

          <h2>Product information and tolerances</h2>
          <p>
            We publish diameter tolerance and other specifications for our filament
            and test against them. Colour reproduction on a screen is approximate, and
            small batch-to-batch variation in colour is normal. Filament is a
            manufacturing input: printed results depend on your printer, profile and
            environment, and we cannot guarantee the outcome of any particular print.
          </p>

          <h2>Acceptable use</h2>
          <p>
            Use this site lawfully. Do not attempt to break, overload, or gain
            unauthorised access to it, scrape it in a way that degrades it for others,
            or submit false details or unlawful content through our forms. Our name,
            logo, site content and product photography remain ours.
          </p>

          <h2>Limitation of liability</h2>
          <p>
            We are responsible for loss you suffer that is a foreseeable result of our
            breaking these terms or failing to use reasonable care. We are not liable
            for indirect or consequential loss, including lost print time, wasted
            material, lost profit, or damage to equipment arising from how filament is
            used. Nothing here excludes liability that cannot lawfully be excluded,
            including for death or personal injury caused by our negligence, or for
            fraud.
          </p>

          <h2>Governing law</h2>
          <p>
            These terms are governed by the laws of the Federal Republic of Nigeria,
            and the Nigerian courts have jurisdiction over any dispute arising from
            them.
          </p>

          <h2>Contact</h2>
          <p>
            Questions about these terms? Reach us through{" "}
            <a href="/contact">our contact page</a>.
          </p>
        </Prose>
      </Container>
    </Section>
  );
}
