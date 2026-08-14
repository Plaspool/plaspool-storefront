import Link from "next/link";

export default function Page() {
  return (
    <div className="flex flex-col items-start gap-3 p-6">
      <p className="font-mono text-sm">
        Handover complete — the gateway redirected here. In the host app this is
        <span className="font-bold"> /store</span>.
      </p>
      {/* A client-side nav back into the gateway, so the sequence can be
          replayed without a full reload. */}
      <Link href="/shop" className="text-sm underline underline-offset-4">
        Replay the gateway
      </Link>
    </div>
  );
}
