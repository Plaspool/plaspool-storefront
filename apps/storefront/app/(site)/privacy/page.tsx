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
            <strong>Last updated:</strong> 31 August 2026
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
              <strong>Your account.</strong> If you create a PlaSpool account, the
              email address it is keyed on, your name, and — when your sign-in
              provider supplies one — your profile picture. If you sign in with
              Google, see <a href="#google-sign-in">Signing in with Google</a>{" "}
              below for exactly what Google sends us.
            </li>
            <li>
              <strong>Orders.</strong> What you ordered, the delivery address and
              phone number you gave us, and the status of the order. We never see
              or store your card details: payment happens on Paystack&apos;s own
              hosted page, not on ours.
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
            To answer your enquiries, to create and run your account, to fulfil and
            deliver orders and keep you updated on them, and to understand which
            parts of the site are useful. We do not sell your personal information,
            and we do not use it for advertising or to build a profile of you.
          </p>

          <h2 id="google-sign-in">Signing in with Google</h2>
          <p>
            You can browse the whole catalogue and place an order without an
            account. If you do create one, you can either use your email address or
            choose <strong>Continue with Google</strong>.
          </p>
          <p>
            When you choose Continue with Google, Google asks for your permission
            and then sends us the basic profile information on your Google Account:
            your <strong>name</strong>, your <strong>email address</strong>, your{" "}
            <strong>profile picture</strong> and your Google account identifier.
            That is all we ask for. We do <em>not</em> request access to Gmail,
            Drive, Contacts, Calendar, Photos or any other Google service, and we
            cannot read them. Your Google password is never shared with us — Google
            performs the sign-in itself.
          </p>
          <p>We use the information Google sends us only to run your account:</p>
          <ul>
            <li>to create your account and sign you back in on later visits;</li>
            <li>
              to attach your orders to you, so you can see your order history,
              delivery status and returns;
            </li>
            <li>to contact you about an order you have placed.</li>
          </ul>
          <p>
            We do <strong>not</strong> sell this information, use it for advertising
            or profiling, or transfer it to anyone other than the service providers
            named below, except where the law requires it. If we ever wanted to use
            it for a new purpose, we would ask you first.
          </p>

          <h2>Cookies</h2>
          <p>
            Necessary cookies keep the site working. Analytics cookies are optional
            and off until you accept them. You can change your choice at any time
            through the cookie preferences link in the footer.
          </p>

          <h2>Who we share it with</h2>
          <p>
            Service providers who help us operate, each processing data on our
            instructions and for no purpose of their own:
          </p>
          <ul>
            <li>
              <strong>Clerk</strong> — our authentication provider. It runs the
              sign-in, including Continue with Google, and holds your account
              profile.
            </li>
            <li>
              <strong>Paystack</strong> — our payment provider, which takes the
              payment and tells us whether it succeeded.
            </li>
            <li>
              <strong>Our delivery partners</strong> — given the name, address and
              phone number needed to bring your order to you.
            </li>
            <li>
              Our email delivery provider, our hosting provider, and our analytics
              provider where you have consented.
            </li>
          </ul>
          <p>
            We do not sell your personal information to anyone, and we share it
            beyond this list only where the law requires it.
          </p>

          <h2>How long we keep it</h2>
          <p>
            Your account and its data are kept for as long as the account exists.
            Order records are kept for as long as we need them for tax, accounting
            and warranty purposes. Contact enquiries are kept for as long as needed
            to answer them and to keep a record of our correspondence. Analytics
            data is retained on our analytics provider&apos;s standard schedule.
          </p>

          <h2>Deleting your account and disconnecting Google</h2>
          <p>
            You can disconnect PlaSpool from your Google Account at any time from{" "}
            <a
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noreferrer noopener"
            >
              your Google Account&apos;s third-party access page
            </a>
            . That stops any further sign-in with Google, but it does not by itself
            erase what we already hold.
          </p>
          <p>
            To have that erased, <a href="/contact">contact us</a> and ask us to
            delete your account. We will delete your account and profile, keeping
            only the order records we are required to retain for tax and accounting
            purposes.
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
