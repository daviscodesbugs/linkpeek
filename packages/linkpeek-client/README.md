# linkpeek-client

Tiny, zero-dependency client for the [LinkPeek](https://github.com/daviscodesbugs/linkpeek) link preview & OpenGraph metadata API.

One call returns **title, description, images, favicon, site name, canonical URL, RSS/Atom feeds, oEmbed endpoint, and full OpenGraph + Twitter Card maps** for any public URL — as clean JSON.

Works in Node 18+, Bun, Deno, Cloudflare Workers, and browsers (CORS enabled).

## Install

```bash
npm install linkpeek-client
```

## Quick start (free, no key needed)

```js
import { peek } from "linkpeek-client";

const meta = await peek("https://github.com");
console.log(meta.title);     // "GitHub · Change is constant…"
console.log(meta.image);     // best og:image / twitter:image
console.log(meta.favicon);   // absolute favicon URL
console.log(meta.feeds);     // discovered RSS/Atom feeds
```

The anonymous tier allows 25 requests/day per IP — perfect for trying it out.

## With an API key (higher quotas)

Subscribe on [RapidAPI](https://rapidapi.com/davispearson93/api/linkpeek-link-preview-and-opengraph-metadata/pricing) — PRO $5/mo (10k req), ULTRA $15/mo (100k req):

```js
import { createClient } from "linkpeek-client";

const linkpeek = createClient({ rapidApiKey: process.env.RAPIDAPI_KEY });
const meta = await linkpeek.preview("https://news.ycombinator.com", { fresh: true });
```

## Response shape

```ts
interface LinkPreview {
  title: string | null;
  description: string | null;
  siteName: string | null;
  image: string | null;        // best candidate
  images: string[];            // all og/twitter images, absolute URLs
  favicon: string | null;
  canonical: string | null;
  feeds: string[];             // RSS/Atom
  oembed: string | null;       // oEmbed endpoint if advertised
  og: Record<string, string>;  // full OpenGraph map
  twitter: Record<string, string>; // full Twitter Card map
  author: string | null;
  published: string | null;    // article:published_time
  // …plus url, finalUrl, status, contentType, fetchedAt
}
```

## License

MIT
