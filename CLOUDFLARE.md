# Cloudflare Workers par deploy karna

1. Node.js 22+ install karein.
2. Is folder mein:
   npm install
   npx wrangler login
   npm run deploy
3. Deploy ke baad aapko https://zenoplayer.<aapka-naam>.workers.dev jaisa link milega.

Local test: npm run cf:preview  (http://localhost:8787)

Custom domain lagane par uska naam src/lib/proxy-guard.ts ki ALLOWED list mein add karein,
warna movies "Forbidden" dikhayengi. *.workers.dev aur *.pages.dev pehle se allowed hain.
