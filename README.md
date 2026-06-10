# LinkPeek 🔗👀

[![npm](https://img.shields.io/npm/v/linkpeek-client?label=linkpeek-client)](https://www.npmjs.com/package/linkpeek-client)
[![License: MIT](https://img.shields.io/badge/License-MIT-teal.svg)](LICENSE)
[![RapidAPI](https://img.shields.io/badge/RapidAPI-subscribe-blue)](https://rapidapi.com/davispearson93/api/linkpeek-link-preview-and-opengraph-metadata)
[![Blog post](https://img.shields.io/badge/dev.to-launch%20post-black)](https://dev.to/daviscodesbugs/i-built-a-link-preview-api-on-cloudflare-workers-and-learned-kv-is-not-a-counter-3d78)

**Link Preview & OpenGraph metadata API** — one GET request returns title, description, images, favicon, site name, canonical URL, RSS/Atom feeds, oEmbed endpoint, and the full OpenGraph + Twitter Card maps for any public URL. Clean JSON, no HTML soup.

Runs on Cloudflare Workers: global edge network, no cold starts, edge-cached responses.

## Try it (free, no signup)

```bash
curl "https://linkpeek.dpears.workers.dev/v1/preview?url=https://github.com"
```

```json
{
  "title": "GitHub · Change is constant. GitHub keeps you ahead.",
  "description": "Join the world's most widely adopted, AI-powered developer platform…",
  "siteName": "GitHub",
  "image": "https://images.ctfassets.net/…/GH-Homepage-Universe-img.png",
  "favicon": "https://github.com/fluidicon.png",
  "canonical": "https://github.com/",
  "feeds": [],
  "og": { "site_name": "GitHub", "type": "object", "…": "…" },
  "twitter": { "site": "@github", "card": "summary_large_image", "…": "…" }
}
```

## Use cases

- **Chat & messaging apps** — rich link cards like Slack/Discord/iMessage
- **Social feeds, forums, comments** — auto-unfurl pasted URLs
- **CMS / bookmarking / read-later tools** — store rich metadata alongside saved links
- **SEO dashboards** — audit OpenGraph/Twitter Card coverage at scale
- **Feed discovery** — find RSS/Atom feeds for any site programmatically

## API

### `GET /v1/preview?url={url}`

| Param | Required | Description |
|---|---|---|
| `url` | ✅ | Absolute http(s) URL to extract metadata from |
| `fresh` | — | `true` bypasses the 24h cache (paid plans) |

Returns: `title`, `description`, `siteName`, `image`, `images[]`, `favicon`, `author`,
`published`, `type`, `locale`, `canonical`, `feeds[]`, `oembed`, `og{}`, `twitter{}`,
`finalUrl`, `status`, `contentType`, `fetchedAt`.

### `GET /v1/health`

Service status + version.

## Features

- ⚡ **Fast** — Cloudflare Workers + HTMLRewriter streaming parser; 24h KV edge cache
- 🛡️ **SSRF-safe** — private/internal hosts are blocked
- 🌐 **CORS enabled** — call it straight from your frontend
- 📦 **1MB parse cap & 10s timeout** — predictable behavior on hostile pages
- 🧰 **Non-HTML aware** — graceful responses for images/PDFs/files

## Pricing

| Plan | Price | Quota |
|---|---|---|
| BASIC | $0 | 500 req/mo (or 25/day anonymous, no signup) |
| PRO | $5/mo | 10,000 req/mo |
| ULTRA | $15/mo | 100,000 req/mo + `fresh=true` cache bypass |

👉 **[Subscribe on RapidAPI](https://rapidapi.com/davispearson93/api/linkpeek-link-preview-and-opengraph-metadata/pricing)** — instant key, managed billing, cancel anytime.

## License

MIT — see [LICENSE](LICENSE).

Contact: daviscodesbugs@gmail.com
