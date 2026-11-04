<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- MovieBox API code lives in src/shared/moviebox.js and runs on the server via src/routes/api/public/mb/$.ts; when the server call fails (provider blocks Cloudflare hosting), src/lib/api.ts runs the same module in the browser. Video still needs the server because the provider requires a Referer browsers cannot set.
- Playback treats provider season-zero resources as movies, resolves available qualities before playing, and switches language through provider subject IDs and detail paths so movie requests never accidentally select TV placeholders.
- The MovieBox proxy sends an India X-Forwarded-For on catalogue calls (h5-api, moviebox.ph) because the provider picks catalogue and dubs by region; without it the app gets the Africa catalogue with no Hindi content.
- vite.config.ts builds for Cloudflare Workers (`cloudflare-module` preset, `wrangler.jsonc` at root); `npm run build` writes `dist/` and `wrangler deploy` picks it up, matching how Lovable itself hosts the app.
- The proxy's `ALLOWED` host list in src/routes/api/public/mb/$.ts is the only thing standing between the API and bots, so every new deployment host must be added there or the whole app returns 403.
