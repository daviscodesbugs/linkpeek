/**
 * linkpeek-client — tiny zero-dependency client for the LinkPeek API.
 * https://github.com/daviscodesbugs/linkpeek
 *
 * Works in Node 18+, Bun, Deno, Cloudflare Workers, and browsers (CORS enabled).
 */

const DEFAULT_BASE = "https://linkpeek.dpears.workers.dev";
const RAPIDAPI_BASE = "https://linkpeek-link-preview-and-opengraph-metadata.p.rapidapi.com";
const RAPIDAPI_HOST = "linkpeek-link-preview-and-opengraph-metadata.p.rapidapi.com";

/**
 * Create a LinkPeek client.
 *
 * @param {object} [options]
 * @param {string} [options.rapidApiKey] - RapidAPI key (uses the marketplace gateway; required for PRO/ULTRA quotas)
 * @param {string} [options.apiKey] - Direct LinkPeek API key (x-api-key)
 * @param {string} [options.baseUrl] - Override the API base URL (e.g. self-hosted worker)
 * @param {number} [options.timeoutMs] - Request timeout in milliseconds (default 15000)
 */
export function createClient(options = {}) {
	const { rapidApiKey, apiKey, baseUrl, timeoutMs = 15000 } = options;
	const base = baseUrl || (rapidApiKey ? RAPIDAPI_BASE : DEFAULT_BASE);

	async function request(path, params = {}) {
		const url = new URL(path, base);
		for (const [k, v] of Object.entries(params)) {
			if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
		}
		const headers = {};
		if (rapidApiKey) {
			headers["x-rapidapi-key"] = rapidApiKey;
			headers["x-rapidapi-host"] = RAPIDAPI_HOST;
		} else if (apiKey) {
			headers["x-api-key"] = apiKey;
		}
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeoutMs);
		try {
			const res = await fetch(url, { headers, signal: controller.signal });
			const body = await res.json();
			if (!res.ok) {
				const err = new Error(body && body.error ? body.error : `LinkPeek request failed (${res.status})`);
				err.status = res.status;
				err.body = body;
				throw err;
			}
			return body;
		} finally {
			clearTimeout(timer);
		}
	}

	return {
		/**
		 * Extract link preview / OpenGraph metadata from a URL.
		 * @param {string} url - Absolute http(s) URL to extract metadata from.
		 * @param {object} [opts]
		 * @param {boolean} [opts.fresh] - Bypass the 24h cache (paid plans).
		 * @returns {Promise<import('./index.d.ts').LinkPreview>}
		 */
		preview(url, opts = {}) {
			return request("/v1/preview", { url, fresh: opts.fresh ? "true" : undefined });
		},

		/** Service health check. */
		health() {
			return request("/v1/health");
		},
	};
}

/**
 * One-shot convenience: extract metadata for a single URL.
 * @param {string} url
 * @param {object} [options] - Same options as createClient.
 */
export function peek(url, options = {}) {
	return createClient(options).preview(url, options);
}

export default { createClient, peek };
