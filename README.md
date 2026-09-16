This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Paused state

**The site is currently paused.** The only thing it serves is a "WORK IN PROGRESS"
screen at `/` — no name, no icons, no resume, no 3D scene, no chat. The portfolio
code is untouched, just parked out of the router.

What the pause is made of:

| File | Role |
| --- | --- |
| `src/app/page.tsx` | The pause screen. Static server component, no client JS, no assets. |
| `src/proxy.ts` | The gate. Serves only `/` and `/robots.txt`; 404s every asset, API call and RSC payload; rewrites any other HTML navigation to the pause screen. |
| `src/app/robots.ts` | `Disallow: /` for every crawler. |
| `src/app/_paused/` | The real portfolio page plus the branded icons and manifest. Underscore-prefixed, so Next.js does not route it or pick up its metadata files. |
| `src/app/layout.tsx` | Anonymous metadata (`Work in Progress`, `noindex`), unused fonts no longer preloaded. |
| `src/app/api/chat/route.ts` | `SITE_PAUSED = true` short-circuits the handler — a second lock behind the gate. |

### Bringing the site back

1. Move the portfolio files back out of the private folder:
   ```bash
   git mv src/app/_paused/page.tsx src/app/page.tsx
   git mv src/app/_paused/manifest.json src/app/manifest.json
   git mv src/app/_paused/favicon.ico src/app/favicon.ico
   git mv src/app/_paused/icon0.svg src/app/icon0.svg
   git mv src/app/_paused/icon1.png src/app/icon1.png
   git mv src/app/_paused/apple-icon.png src/app/apple-icon.png
   ```
   (`src/app/page.tsx` is the pause screen — delete or archive it first.)
2. Delete `src/proxy.ts` and `src/app/robots.ts`.
3. In `src/app/layout.tsx`: restore the real `metadata` (title, description,
   `appleWebApp`), drop the `robots` block, and remove the four `preload: false` lines.
4. In `src/app/api/chat/route.ts`: set `SITE_PAUSED` to `false` (or delete the guard).
5. `npm run build` to verify, then deploy.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
