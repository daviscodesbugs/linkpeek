export interface LinkPreview {
	url: string;
	finalUrl: string;
	status: number;
	contentType: string;
	fetchedAt: string;
	title: string | null;
	description: string | null;
	siteName: string | null;
	image: string | null;
	images: string[];
	favicon: string | null;
	author: string | null;
	published: string | null;
	type: string | null;
	locale: string | null;
	canonical: string | null;
	feeds: string[];
	oembed: string | null;
	twitter: Record<string, string>;
	og: Record<string, string>;
	cached?: boolean;
}

export interface ClientOptions {
	/** RapidAPI key (marketplace gateway; required for PRO/ULTRA quotas) */
	rapidApiKey?: string;
	/** Direct LinkPeek API key (x-api-key) */
	apiKey?: string;
	/** Override the API base URL (e.g. self-hosted worker) */
	baseUrl?: string;
	/** Request timeout in milliseconds (default 15000) */
	timeoutMs?: number;
}

export interface PreviewOptions {
	/** Bypass the 24h cache (paid plans) */
	fresh?: boolean;
}

export interface LinkPeekClient {
	preview(url: string, opts?: PreviewOptions): Promise<LinkPreview>;
	health(): Promise<{ ok: boolean; version: string }>;
}

export function createClient(options?: ClientOptions): LinkPeekClient;
export function peek(url: string, options?: ClientOptions & PreviewOptions): Promise<LinkPreview>;

declare const _default: { createClient: typeof createClient; peek: typeof peek };
export default _default;
