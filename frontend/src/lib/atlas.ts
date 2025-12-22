export type Decision = "BLOCK" | "REVIEW" | "PASS";

export type AtlasFlag = {
  code: string;
  severity: "BLOCK_FLAG" | "REVIEW_FLAG" | "WARN_SIGNAL" | "INFO_SIGNAL";
  gate?: string;
  details?: any;
  related_urls?: string[];
};

export type AtlasReason = {
  dimension?: string;
  rule_id: string;
  message: string;
  suggested_action: string;
  confidence?: number;
};

export type AtlasMetadata = {
  ruleset_version: string;
  inputs_hash: string;
  timestamp: string;
};

async function atlasFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/atlas${path}`, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      "content-type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`ATLAS API error ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

// ---- Endpoints ----

export function getRulesetCurrent() {
  return atlasFetch<{ active: string; ruleset: any }>("/v1/rulesets/current");
}

export function postSites(payload: any) {
  return atlasFetch<any>("/v1/sites", {
    method: "POST",
    body: JSON.stringify(payload ?? {}),
  });
}

export function runPrecheck(payload: any) {
  return atlasFetch<any>("/v1/atlas/precheck", {
    method: "POST",
    body: JSON.stringify(payload ?? {}),
  });
}

export function runScore(payload: any) {
  return atlasFetch<any>("/v1/atlas/score", {
    method: "POST",
    body: JSON.stringify(payload ?? {}),
  });
}

export function listEvents(query?: Record<string, string>) {
  const qs = query ? `?${new URLSearchParams(query).toString()}` : "";
  return atlasFetch<any>(`/v1/atlas/events${qs}`);
}
