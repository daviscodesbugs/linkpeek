# Endpoint Verification — June 10, 2026

## Direct worker (linkpeek.dpears.workers.dev)
| # | Case | Result |
|---|------|--------|
| 1 | GET /v1/health | ✅ {ok:true, version:1.0.0} |
| 2 | /v1/preview github.com | ✅ full metadata (title/siteName/image/favicon) |
| 3 | Repeat call | ✅ cached:true (KV 24h cache) |
| 4 | theverge.com | ✅ title + RSS feed discovered |
| 5 | Missing url param | ✅ 400 "Missing required query parameter: url" |
| 6 | Invalid url | ✅ 400 "Invalid URL" |
| 7 | Private host (192.168.1.1) | ✅ 400 "Target host not allowed" (SSRF guard) |
| 8 | Non-HTML (favicon.ico) | ✅ type:file, contentType reported |
| 9 | Unknown route | ✅ 404 |
| 10 | Landing page / | ✅ HTML served |

## RapidAPI gateway (linkpeek-…p.rapidapi.com) — subscriber path
| # | Case | Result |
|---|------|--------|
| 1 | Auth with app key | ✅ 200, proxy secret honored (no anon quota) |
| 2 | No key | ✅ 401 Invalid API key (gateway enforces) |
| 3 | github.com | ✅ full metadata, cache working |
| 4 | wikipedia.org | ✅ clean extraction |
| 5 | Missing url param | ✅ 400 passes through |
| 6 | fresh=true | ✅ cached:false — paid cache-bypass works |
| 7 | /v1/health via gateway | ⚠️ 404 — only /v1/preview is defined in the listing (by design; health remains on direct URL). Optional: add Health endpoint to listing. |

## Notes
- Sites behind aggressive bot protection (e.g. stackoverflow.com) return their challenge
  page status (403) — reported truthfully in `status`; not a defect.
- Billing plans verified live on the listing: BASIC $0/500mo, PRO $5/10k, ULTRA $15/100k.

## Addendum — rate limit hardening (June 10)
- DEFECT FOUND during verification: KV-based daily counter alone did not enforce the
  anon limit under burst (KV is eventually consistent; 27 sequential anon requests → all 200).
- FIX: added Workers Rate Limiting binding (10 req/min per IP, per-colo accurate) in front
  of the KV daily cap.
- VERIFIED: parallel burst of 16 anon requests → 5×200 + 11×429 with subscribe CTA in the
  error body. Paid tiers (x-api-key, RapidAPI gateway) confirmed unaffected (200s).
- Direct-key tier now live: DIRECT_KEYS secret set; key stored at `pass show linkpeek/direct-key`;
  verified fresh=true cache bypass works for that tier.
