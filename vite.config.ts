// @lovable.dev/vite-tanstack-config already includes tanstackStart, react, tailwind, paths, nitro etc.
// Build target is picked automatically:
//  - On Vercel (VERCEL env is set during Vercel builds) → "vercel" preset (.vercel/output).
//  - Everywhere else → Cloudflare Workers ("cloudflare-module"), deploy with `npx wrangler deploy`.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const onVercel = Boolean(process.env["VERCEL"]);

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  nitro: onVercel
    ? {
        preset: "vercel",
        // Long movies stream through the server; give each request the max time Vercel allows.
        vercel: { functions: { maxDuration: 300 } },
      }
    : {
        preset: "cloudflare-module",
        cloudflare: { deployConfig: true, nodeCompat: true },
      },
});
