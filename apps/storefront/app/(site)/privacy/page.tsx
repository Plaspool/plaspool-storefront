import { Container, Prose, Section } from "@plaspool/ui";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "How PlaSpool collects, uses and protects your personal information.",
  alternates: { canonical: "/privacy" },
};

export default function Page() {
  return (
    <Section>
      <Container>
        <Prose>
          <h1>Privacy policy</h1>
          <p>
            <strong>Last updated:</strong> 14 August 2026
          </p>

          <h2>Who we are</h2>
          <p>
            PlaSpool sells 3D printing filament in Nigeria. Contact us at{" "}
            <a href="/contact">our contact page</a> with any question about this
            policy.
          </p>

          <h2>What we collect</h2>
          <ul>
            <li>
              <strong>Information you give us.</strong> Your name, email address,
              phone number and message when you use the contact form or join the
              waitlist.
            </li>
            <li>
              <strong>Analytics.</strong> Pages visited and approximate location,
              through Google Analytics — <em>only</em> if you accept analytics
              cookies. Reject them and no analytics tag is loaded at all.
            </li>
            <li>
              <strong>Technical data.</strong> Your browser sends an IP address and
              user agent with each request; these are used to serve the site and are
              not used to build a profile of you.
            </li>
          </ul>

          <h2>Why we use it</h2>
          <p>
            To answer your enquiries, to fulfil and deliver orders, and to understand
            which parts of the site are useful. We do not sell your personal
            information.
          </p>

          <h2>Cookies</h2>
          <p>
            Necessary cookies keep the site working. Analytics cookies are optional
            and off until you accept them. You can change your choice at any time
            through the cookie preferences link in the footer.
          </p>

          <h2>Who we share it with</h2>
          <p>
            Service providers who help us operate: our email delivery provider, our
            analytics provider where you have consented, and our hosting provider.
            Each processes data on our instructions.
          </p>

          <h2>How long we keep it</h2>
          <p>
            Contact enquiries are kept for as long as needed to answer them and to
            keep a record of our correspondence. Analytics data is retained on our
            analytics provider&apos;s standard schedule.
          </p>

          <h2>Your rights</h2>
          <p>
            Under the Nigeria Data Protection Act you may ask for a copy of your
            personal data, ask us to correct or delete it, or object to how we use
            it. Contact us and we will respond.
          </p>

          <h2>Changes</h2>
          <p>
            If we change this policy we will update the date above and post the new
            version on this page.
          </p>
        </Prose>
      </Container>
    </Section>
  );
}
