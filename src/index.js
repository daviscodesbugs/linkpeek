/**
 * LinkPeek — Link Preview & OpenGraph Metadata API
 * Extracts title, description, images, favicon, oEmbed hints, and more
 * from any public URL. Built on Cloudflare Workers + HTMLRewriter.
 *
 * Monetization: listed on RapidAPI (subscription tiers) + direct keys.
 */

const VERSION = "1.0.0";
const CACHE_TTL = 60 * 60 * 24; // 24h KV cache
const FETCH_TIMEOUT_MS = 10000;
const MAX_BODY_BYTES = 1024 * 1024; // stop parsing after 1MB of HTML
const FREE_DAILY_LIMIT = 25; // anonymous demo per-IP daily quota

const SECURITY_HEADERS = {
	"access-control-allow-origin": "*",
	"access-control-allow-headers": "content-type, x-api-key, x-rapidapi-key",
	"x-linkpeek-version": VERSION,
};

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);

		if (request.method === "OPTIONS") {
			return new Response(null, { headers: SECURITY_HEADERS });
		}

		if (url.pathname === "/" || url.pathname === "/index.html") {
			return new Response(LANDING_HTML, {
				headers: { "content-type": "text/html;charset=utf-8", ...SECURITY_HEADERS },
			});
		}

		if (url.pathname === "/v1/preview" || url.pathname === "/v1/extract") {
			return handlePreview(request, url, env, ctx);
		}

		if (url.pathname === "/v1/health") {
			return json({ ok: true, version: VERSION });
		}

		return json({ error: "Not found. See https://linkpeek.dpears.workers.dev/ for docs." }, 404);
	},
};

async function handlePreview(request, url, env, ctx) {
	const target = url.searchParams.get("url");
	if (!target) return json({ error: "Missing required query parameter: url" }, 400);

	let parsed;
	try {
		parsed = new URL(target);
	} catch {
		return json({ error: "Invalid URL" }, 400);
	}
	if (!/^https?:$/.test(parsed.protocol)) {
		return json({ error: "Only http/https URLs are supported" }, 400);
	}
	if (isPrivateHost(parsed.hostname)) {
		return json({ error: "Target host not allowed" }, 400);
	}

	// ---- auth & rate limiting ----
	const rapidProxySecret = request.headers.get("x-rapidapi-proxy-secret");
	const apiKey = request.headers.get("x-api-key");
	let tier = "anon";

	if (env.RAPIDAPI_PROXY_SECRET && rapidProxySecret === env.RAPIDAPI_PROXY_SECRET) {
		tier = "rapidapi"; // RapidAPI enforces quotas/billing upstream
	} else if (env.DIRECT_KEYS && apiKey && env.DIRECT_KEYS.split(",").includes(apiKey)) {
		tier = "direct";
	} else {
		// anonymous demo tier: burst limiter (accurate, per-colo) + daily KV cap (eventual)
		const ip = request.headers.get("cf-connecting-ip") || "0.0.0.0";
		if (env.ANON_LIMITER) {
			const { success } = await env.ANON_LIMITER.limit({ key: ip });
			if (!success) {
				return json(
					{
						error: "Rate limit exceeded (10 requests/minute on the free demo). Subscribe for higher limits.",
						subscribe: "https://rapidapi.com/davispearson93/api/linkpeek-link-preview-and-opengraph-metadata/pricing",
					},
					429,
				);
			}
		}
		const day = new Date().toISOString().slice(0, 10);
		const quotaKey = `quota:${ip}:${day}`;
		const used = parseInt((await env.CACHE.get(quotaKey)) || "0", 10);
		if (used >= FREE_DAILY_LIMIT) {
			return json(
				{
					error: `Free demo limit (${FREE_DAILY_LIMIT}/day) reached. Subscribe for higher limits.`,
					subscribe: "https://linkpeek.dpears.workers.dev/#pricing",
				},
				429,
			);
		}
		ctx.waitUntil(env.CACHE.put(quotaKey, String(used + 1), { expirationTtl: 90000 }));
	}

	// ---- cache ----
	const cacheKey = `preview:${parsed.href}`;
	const skipCache = url.searchParams.get("fresh") === "true" && tier !== "anon";
	if (!skipCache) {
		const cached = await env.CACHE.get(cacheKey, "json");
		if (cached) {
			return json({ ...cached, cached: true });
		}
	}

	// ---- fetch target ----
	let resp;
	try {
		resp = await fetchWithTimeout(parsed.href);
	} catch (e) {
		return json({ error: "Failed to fetch target URL", detail: String(e && e.message) }, 502);
	}

	const contentType = resp.headers.get("content-type") || "";
	const result = {
		url: parsed.href,
		finalUrl: resp.url || parsed.href,
		status: resp.status,
		contentType: contentType.split(";")[0].trim(),
		fetchedAt: new Date().toISOString(),
		title: null,
		description: null,
		siteName: null,
		image: null,
		images: [],
		favicon: null,
		author: null,
		published: null,
		type: null,
		locale: null,
		canonical: null,
		feeds: [],
		oembed: null,
		twitter: {},
		og: {},
	};

	if (!contentType.includes("text/html")) {
		// Non-HTML: return basic info (useful for images/PDFs)
		result.title = parsed.pathname.split("/").pop() || parsed.hostname;
		result.type = "file";
		ctx.waitUntil(env.CACHE.put(cacheKey, JSON.stringify(result), { expirationTtl: CACHE_TTL }));
		return json(result);
	}

	await parseHtml(resp, result);
	finalizeResult(result, parsed);

	ctx.waitUntil(env.CACHE.put(cacheKey, JSON.stringify(result), { expirationTtl: CACHE_TTL }));
	return json(result);
}

// ---------------------------------------------------------------- helpers

function json(obj, status = 200) {
	return new Response(JSON.stringify(obj, null, 2), {
		status,
		headers: { "content-type": "application/json;charset=utf-8", ...SECURITY_HEADERS },
	});
}

function isPrivateHost(host) {
	if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host)) return true;
	if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
	if (host === "[::1]" || host.endsWith(".local") || host.endsWith(".internal")) return true;
	return false;
}

async function fetchWithTimeout(href) {
	const controller = new AbortController();
	const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
	try {
		return await fetch(href, {
			signal: controller.signal,
			redirect: "follow",
			headers: {
				"user-agent": "Mozilla/5.0 (compatible; LinkPeekBot/1.0; +https://linkpeek.dpears.workers.dev)",
				accept: "text/html,application/xhtml+xml,*/*;q=0.8",
				"accept-language": "en-US,en;q=0.9",
			},
			cf: { cacheTtl: 300, cacheEverything: false },
		});
	} finally {
		clearTimeout(t);
	}
}

async function parseHtml(resp, result) {
	let bytes = 0;
	let stopped = false;

	const metaHandler = {
		element(el) {
			const prop = (el.getAttribute("property") || el.getAttribute("name") || "").toLowerCase();
			const content = el.getAttribute("content");
			if (!prop || !content) return;

			if (prop.startsWith("og:")) {
				const key = prop.slice(3);
				if (!(key in result.og)) result.og[key] = content;
				if (prop === "og:image" || prop === "og:image:url" || prop === "og:image:secure_url") {
					result.images.push(content);
				}
			} else if (prop.startsWith("twitter:")) {
				const key = prop.slice(8);
				if (!(key in result.twitter)) result.twitter[key] = content;
			} else if (prop === "description" && !result.description) {
				result.description = content;
			} else if ((prop === "author" || prop === "article:author") && !result.author) {
				result.author = content;
			} else if (prop === "article:published_time" && !result.published) {
				result.published = content;
			}
		},
	};

	let titleText = "";
	const rewriter = new HTMLRewriter()
		.on("meta", metaHandler)
		.on("title", {
			text(t) {
				if (titleText.length < 512) titleText += t.text;
			},
		})
		.on("link", {
			element(el) {
				const rel = (el.getAttribute("rel") || "").toLowerCase();
				const href = el.getAttribute("href");
				if (!href) return;
				if (rel.includes("icon") && !result.favicon) result.favicon = href;
				if (rel === "canonical" && !result.canonical) result.canonical = href;
				if (rel === "alternate") {
					const type = (el.getAttribute("type") || "").toLowerCase();
					if (type.includes("rss") || type.includes("atom")) {
						result.feeds.push(href);
					} else if (type.includes("json+oembed") && !result.oembed) {
						result.oembed = href;
					}
				}
			},
		});

	const transformed = rewriter.transform(resp);
	const reader = transformed.body.getReader();
	while (!stopped) {
		const { done, value } = await reader.read();
		if (done) break;
		bytes += value ? value.length : 0;
		if (bytes > MAX_BODY_BYTES) {
			stopped = true;
			try { await reader.cancel(); } catch {}
		}
	}
	if (titleText) result.title = titleText.trim().replace(/\s+/g, " ");
}

function finalizeResult(result, parsed) {
	const og = result.og, tw = result.twitter;
	result.title = og.title || tw.title || result.title;
	result.description = og.description || tw.description || result.description;
	result.siteName = og.site_name || parsed.hostname;
	result.type = og.type || (tw.card ? "website" : result.type) || "website";
	result.locale = og.locale || null;
	result.published = result.published || og.published_time || null;

	const candidates = [...result.images, tw.image, tw["image:src"]].filter(Boolean);
	result.images = [...new Set(candidates.map((i) => absolutize(i, parsed)))];
	result.image = result.images[0] || null;

	if (result.favicon) result.favicon = absolutize(result.favicon, parsed);
	else result.favicon = `${parsed.protocol}//${parsed.hostname}/favicon.ico`;
	if (result.canonical) result.canonical = absolutize(result.canonical, parsed);
	result.feeds = result.feeds.map((f) => absolutize(f, parsed));
	if (result.oembed) result.oembed = absolutize(result.oembed, parsed);
}

function absolutize(href, base) {
	try {
		return new URL(href, base.href).href;
	} catch {
		return href;
	}
}

// ---------------------------------------------------------------- landing

const LANDING_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>LinkPeek — Link Preview & OpenGraph API</title>
<meta name="description" content="Fast, reliable link preview API. Extract title, description, images, favicon, RSS feeds and OpenGraph/Twitter metadata from any URL. Free tier, simple JSON, global edge network.">
<style>
:root{--bg:#0b1020;--card:#141b33;--acc:#5eead4;--txt:#e2e8f0;--dim:#94a3b8}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--txt);line-height:1.6}
.wrap{max-width:880px;margin:0 auto;padding:48px 24px}
h1{font-size:2.4rem;margin-bottom:8px}
h1 .peek{color:var(--acc)}
.tag{color:var(--dim);font-size:1.15rem;margin-bottom:32px}
.card{background:var(--card);border-radius:12px;padding:24px;margin:24px 0}
pre{background:#0a0f1f;border-radius:8px;padding:16px;overflow-x:auto;font-size:.88rem;color:#a5f3fc}
code{font-family:ui-monospace,monospace}
h2{margin:32px 0 12px;font-size:1.4rem}
table{width:100%;border-collapse:collapse;margin:16px 0}
td,th{padding:10px;text-align:left;border-bottom:1px solid #1e2a4a}
th{color:var(--dim);font-weight:600}
.price{font-size:1.6rem;font-weight:700;color:var(--acc)}
a{color:var(--acc)}
.btn{display:inline-block;background:var(--acc);color:#0b1020;font-weight:700;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:8px}
.muted{color:var(--dim);font-size:.9rem}
</style>
</head>
<body>
<div class="wrap">
<h1>Link<span class="peek">Peek</span></h1>
<p class="tag">The no-nonsense link preview API. One GET request → rich metadata for any URL. Built on a global edge network: fast everywhere, no cold starts.</p>

<div class="card">
<strong>Try it right now</strong> (free, no signup — 25 requests/day):
<div style="display:flex;gap:8px;margin:12px 0">
<input id="demo-url" type="url" placeholder="https://example.com" value="https://github.com" style="flex:1;padding:10px 12px;border-radius:8px;border:1px solid #1e2a4a;background:#0a0f1f;color:#e2e8f0;font-size:.95rem">
<button id="demo-btn" style="background:#5eead4;color:#0b1020;font-weight:700;border:0;border-radius:8px;padding:10px 18px;cursor:pointer">Peek</button>
</div>
<div id="demo-card" style="display:none;border:1px solid #1e2a4a;border-radius:8px;padding:14px;margin:10px 0;display:none"></div>
<pre id="demo-json" style="display:none;max-height:300px;overflow:auto"></pre>
<pre id="demo-curl"><code>curl "https://linkpeek.dpears.workers.dev/v1/preview?url=https://github.com"</code></pre>
Returns title, description, images, favicon, site name, canonical URL, RSS feeds, oEmbed endpoint, full OpenGraph + Twitter Card maps, and more — as clean JSON.
<script>
document.getElementById('demo-btn').addEventListener('click', runDemo);
document.getElementById('demo-url').addEventListener('keydown', e => { if (e.key === 'Enter') runDemo(); });
async function runDemo() {
  const u = document.getElementById('demo-url').value.trim();
  if (!u) return;
  const btn = document.getElementById('demo-btn');
  btn.textContent = '…'; btn.disabled = true;
  const cardEl = document.getElementById('demo-card');
  const jsonEl = document.getElementById('demo-json');
  try {
    const res = await fetch('/v1/preview?url=' + encodeURIComponent(u));
    const data = await res.json();
    jsonEl.style.display = 'block';
    jsonEl.textContent = JSON.stringify(data, null, 2);
    if (data.title || data.image) {
      cardEl.style.display = 'block';
      cardEl.innerHTML = '';
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;gap:14px;align-items:flex-start';
      if (data.image) { const img = document.createElement('img'); img.src = data.image; img.style.cssText = 'width:120px;height:90px;object-fit:cover;border-radius:6px;flex-shrink:0'; img.onerror = () => img.remove(); wrap.appendChild(img); }
      const txt = document.createElement('div');
      const t = document.createElement('div'); t.textContent = data.title || ''; t.style.cssText = 'font-weight:700;margin-bottom:4px';
      const d = document.createElement('div'); d.textContent = (data.description || '').slice(0, 180); d.style.cssText = 'color:#94a3b8;font-size:.88rem';
      const s = document.createElement('div'); s.style.cssText = 'color:#5eead4;font-size:.8rem;margin-top:6px;display:flex;gap:6px;align-items:center';
      if (data.favicon) { const f = document.createElement('img'); f.src = data.favicon; f.style.cssText = 'width:14px;height:14px'; f.onerror = () => f.remove(); s.appendChild(f); }
      s.appendChild(document.createTextNode(data.siteName || ''));
      txt.appendChild(t); txt.appendChild(d); txt.appendChild(s); wrap.appendChild(txt);
      cardEl.appendChild(wrap);
    }
    document.getElementById('demo-curl').querySelector('code').textContent = 'curl "https://linkpeek.dpears.workers.dev/v1/preview?url=' + u + '"';
  } catch (e) {
    jsonEl.style.display = 'block';
    jsonEl.textContent = 'Request failed: ' + e.message;
  }
  btn.textContent = 'Peek'; btn.disabled = false;
}
</script>
</div>

<h2>Why LinkPeek?</h2>
<table>
<tr><th></th><th>LinkPeek</th><th>Typical competitors</th></tr>
<tr><td>Median latency</td><td>&lt;400ms (edge cached: &lt;50ms)</td><td>1–3s</td></tr>
<tr><td>Free tier</td><td>25 req/day, no signup</td><td>requires card</td></tr>
<tr><td>OG + Twitter + feeds + oEmbed</td><td>✅ all in one call</td><td>partial</td></tr>
<tr><td>SSRF-safe, CORS enabled</td><td>✅</td><td>varies</td></tr>
</table>

<h2 id="pricing">Pricing</h2>
<div class="card">
<p><span class="price">$0</span>/mo — BASIC: 500 req/mo (25/day anonymous demo, no signup)</p>
<p><span class="price">$5</span>/mo — PRO: 10,000 req/mo</p>
<p><span class="price">$15</span>/mo — ULTRA: 100,000 req/mo, cache-bypass with <code>fresh=true</code></p>
<p class="muted">Subscribe on RapidAPI — instant API key, managed billing, cancel anytime. Prefer a direct key? Email
<a href="mailto:daviscodesbugs@gmail.com">daviscodesbugs@gmail.com</a>.</p>
<a class="btn" href="https://rapidapi.com/davispearson93/api/linkpeek-link-preview-and-opengraph-metadata/pricing">Subscribe on RapidAPI →</a>
</div>

<h2>Docs</h2>
<div class="card">
<p><code>GET /v1/preview?url={url}</code> — extract metadata. Optional <code>fresh=true</code> (paid) bypasses the 24h cache.</p>
<p><code>GET /v1/health</code> — service status.</p>
<p>Auth: <code>x-api-key</code> header (direct) or subscribe on RapidAPI. Anonymous requests get the demo quota.</p>
</div>

<p class="muted">Built and operated by ProtoPlay Creative · Herriman, UT</p>
</div>
</body>
</html>`;
