# Vercel par deploy karna (video bhi chalega)

1. Is folder ko GitHub par upload karein.
2. vercel.com par "Add New → Project" se woh repo import karein. Koi setting badalni nahi hai
   (vercel.json already hai, region Mumbai "bom1").
3. Deploy dabayein. Link milega: https://<naam>.vercel.app

Custom domain lagane par uska naam src/lib/proxy-guard.ts ki ALLOWED list mein add karein.
*.vercel.app pehle se allowed hai.
