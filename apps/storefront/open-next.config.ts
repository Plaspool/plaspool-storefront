import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// No bindings configured: this ships with no incremental cache, no KV, no R2.
// ISR (see LIST_REVALIDATE / DETAIL_REVALIDATE in packages/blog) will not
// persist across Worker instances without one. An R2-backed incremental
// cache can be added later — see the @opennextjs/cloudflare docs — once a
// bucket is provisioned; deliberately out of scope here so `deploy` works
// without provisioning any Cloudflare resources.
export default defineCloudflareConfig();
