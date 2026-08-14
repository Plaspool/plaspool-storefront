import { CreditCard, PackageCheck, Truck } from "lucide-react";
import { cn } from "@plaspool/ui";

import { DELIVERY, PAYMENT_METHODS } from "../data/config";
import { formatNaira } from "../data/money";

/**
 * Delivery timelines, returns, and the payment methods the store takes —
 * stated on the product page rather than discovered at a checkout.
 *
 * None of the three references does this well for this market. Bambu's top bar
 * exists because region uncertainty loses sales; the Nigerian equivalent is
 * delivery and payment uncertainty, and both are answerable here for free.
 *
 * Payment methods are named, not shown as card-brand logos: "Bank transfer"
 * and "USSD" have no logo, and a row of Visa and Mastercard marks would imply
 * they are the only two ways to pay.
 */

export interface OrderInfoProps {
  className?: string;
}

export function OrderInfo({ className }: OrderInfoProps) {
  return (
    <section
      aria-labelledby="order-info-heading"
      className={cn("border-t border-brand-line pt-10", className)}
    >
      <h2 id="order-info-heading" className="font-sans text-lg font-semibold text-foreground">
        Delivery, returns and payment
      </h2>

      <div className="mt-6 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Truck aria-hidden="true" className="h-5 w-5 text-brand" />
          <h3 className="font-sans text-sm font-semibold text-foreground">Delivery</h3>
          <ul className="flex flex-col gap-1.5 text-sm leading-6 text-muted-foreground">
            <li>{DELIVERY.lagos}</li>
            <li>{DELIVERY.nationwide}</li>
            <li>
              Free over{" "}
              <span className="font-mono font-bold tabular-nums text-foreground">
                {formatNaira(DELIVERY.freeOver)}
              </span>
            </li>
          </ul>
        </div>

        <div className="flex flex-col gap-2">
          <PackageCheck aria-hidden="true" className="h-5 w-5 text-brand" />
          <h3 className="font-sans text-sm font-semibold text-foreground">Returns</h3>
          <p className="text-sm leading-6 text-muted-foreground">{DELIVERY.returns}</p>
        </div>

        <div className="flex flex-col gap-2">
          <CreditCard aria-hidden="true" className="h-5 w-5 text-brand" />
          <h3 className="font-sans text-sm font-semibold text-foreground">Payment</h3>
          <ul className="flex flex-col gap-1.5 text-sm leading-6 text-muted-foreground">
            {PAYMENT_METHODS.map((method) => (
              <li key={method}>{method}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
