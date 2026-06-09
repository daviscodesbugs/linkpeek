# LinkPeek — MRR Status

**Goal:** $20 monthly recurring revenue
**Built:** June 9, 2026 (one session, fully autonomous)

## The product
Link Preview / OpenGraph metadata API.
- **Live API:** https://linkpeek.dpears.workers.dev (Cloudflare Workers — $0 hosting on free tier)
- **Marketplace listing (public):** https://rapidapi.com/davispearson93/api/linkpeek-link-preview-and-opengraph-metadata
- **Code:** ~/workspace/make-money/linkpeek (git)

## Revenue infrastructure — all DONE ✅
| Piece | Status |
|---|---|
| Worker deployed + tested | ✅ (GitHub/HN extraction verified) |
| KV cache + anon rate limiting | ✅ 25/day per IP demo tier |
| RapidAPI listing public | ✅ category Tools |
| Pricing plans | ✅ BASIC free (500/mo) · PRO $5/mo (10k) · ULTRA $15/mo (100k) |
| Gateway proxy secret | ✅ RAPIDAPI_PROXY_SECRET set on worker (subscribers bypass anon limit) |
| Payout method | ✅ PayPal connected (davispearson93@gmail.com) — "Ready" |
| Endpoint defined | ✅ GET /v1/preview (+ /v1/health) |

## Path to $20 MRR
4 × PRO ($5) or 1 × PRO + 1 × ULTRA, or any mix.
RapidAPI takes 20% of revenue → need ~$25 gross MRR ($25 = 5×PRO).

## Growth levers (slow growth accepted per Davis)
1. RapidAPI hub organic search — live now ("link preview", "opengraph", "metadata")
2. Publish repo to GitHub w/ README + link (SEO + trust) — TODO
3. OpenAPI spec upload for richer playground params (openapi.json ready; CI/CD API
   requires subscribing to RapidAPI's provisioning API — listing was 404 today) — TODO
4. Dev.to / Hashnode launch post; "show & tell" posts where appropriate — TODO
5. Landing page upgrade: add RapidAPI subscribe link once indexed — TODO
6. Watch RapidAPI Studio → Analytics for first users; respond to support fast — ongoing

## Secrets/keys touched (for Davis's awareness)
- Wrangler OAuth (davispearson93 Cloudflare acct) — stored by wrangler in ~/.config/.wrangler
- RapidAPI app key — used for provisioning attempts (in /tmp/.rapidkey, mode 600); appears in session transcript — **rotate if concerned** (Console → Applications → default-application)
- RapidAPI proxy secret — set as encrypted worker secret
- PayPal — OAuth consent only (no credentials used; existing browser session)
