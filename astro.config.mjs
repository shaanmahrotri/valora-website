// @ts-check
import { defineConfig } from 'astro/config';

// Static output by default — deploys to Netlify, Vercel, Cloudflare Pages or GitHub Pages.
// Set `site` to your production URL (used for canonical URLs / sitemaps).
//
// Decap CMS admin is a plain Astro page at src/pages/admin/index.astro,
// which imports decap-cms-app as a normal ESM module — Vite bundles it like
// any other dependency, no framework-renderer integration needed. Its
// config.yml lives in public/admin/ alongside it. Run `npm run cms` (or
// double-click the Desktop shortcut) to start the local editing proxy.
export default defineConfig({
  site: 'https://valorapartners.co.uk',
});
