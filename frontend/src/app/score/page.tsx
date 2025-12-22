"use client";

import { useMemo, useState } from "react";
import { DecisionBadge } from "@/components/DecisionBadge";
import { ReasonsList } from "@/components/ReasonsList";
import { MetadataBlock } from "@/components/MetadataBlock";
import type { AtlasMetadata } from "@/lib/types";

const DEV_SITE_ID = "7695f038-93bd-4017-b64a-78b5a22ddad4";

type Intent =
  | "informational"
  | "comparative"
  | "transactional"
  | "navigational"
  | "support";

type AtlasFlagApi = {
  code: string;
  severity?: "BLOCK_FLAG" | "REVIEW_FLAG" | "WARN_SIGNAL" | "INFO_SIGNAL";
  gate?: string;
  details?: any;
  related_urls?: string[];
};

type AtlasReasonApi = {
  dimension?: "A" | "B" | "C" | "D" | "E" | "F";
  rule_id: string;
  severity?: "BLOCK_FLAG" | "REVIEW_FLAG" | "WARN_SIGNAL" | "INFO_SIGNAL";
  message: string;
  suggested_action?: string;
  confidence?: number;
  evidence?: any;
};

type AtlasScoreResponse = {
  decision?: "BLOCK" | "REVIEW" | "PASS";
  score_total?: number;
  scores_dimensions?: Record<string, number>;
  flags?: AtlasFlagApi[];
  reasons?: AtlasReasonApi[];

  ruleset_version?: string;
  inputs_hash?: string;
  timestamp?: string;

  [k: string]: any;
};

function SeverityPill({ severity }: { severity?: AtlasFlagApi["severity"] }) {
  if (!severity) return null;

  const base =
    "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium";

  if (severity === "BLOCK_FLAG") {
    return (
      <span className={`${base} border-red-200 bg-red-50 text-red-700`}>
        BLOCK
      </span>
    );
  }
  if (severity === "REVIEW_FLAG") {
    return (
      <span className={`${base} border-amber-200 bg-amber-50 text-amber-700`}>
        REVIEW
      </span>
    );
  }
  if (severity === "WARN_SIGNAL") {
    return (
      <span className={`${base} border-zinc-200 bg-zinc-50 text-zinc-700`}>
        WARN
      </span>
    );
  }
  return (
    <span className={`${base} border-zinc-200 bg-white text-zinc-600`}>
      INFO
    </span>
  );
}

export default function ScorePage() {
  const [siteId, setSiteId] = useState(DEV_SITE_ID);
  const [primaryKeyword, setPrimaryKeyword] = useState("van aménagé");
  const [primaryIntent, setPrimaryIntent] = useState<Intent>("informational");
  const [title, setTitle] = useState("Van aménagé : guide pour bien choisir");
  const [content, setContent] = useState("Contenu de test…");

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AtlasScoreResponse | null>(null);
  const [errorText, setErrorText] = useState("");

  async function onRun() {
    setLoading(true);
    setErrorText("");
    setData(null);

    try {
      const res = await fetch("/api/atlas/v1/atlas/score", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          site_id: siteId,
          title,
          content,
          primary_intent: primaryIntent,
          primary_keyword: primaryKeyword,
        }),
      });

      if (!res.ok) {
        let msg = "";
        try {
          const j = await res.json();
          msg = JSON.stringify(j, null, 2);
        } catch {
          msg = (await res.text().catch(() => "")) || `HTTP ${res.status}`;
        }
        setErrorText(msg);
        return;
      }

      const json = (await res.json()) as AtlasScoreResponse;
      setData(json);
    } catch (e: any) {
      setErrorText(e?.message || "Request failed");
    } finally {
      setLoading(false);
    }
  }

  const decision = data?.decision;
  const scoreTotal = data?.score_total;
  const dims = data?.scores_dimensions;
  const flags = Array.isArray(data?.flags) ? data!.flags! : [];
  const reasons = Array.isArray(data?.reasons) ? data!.reasons! : [];

  // ✅ On ne crée metadata QUE si les 3 champs existent en string
  const metadata: AtlasMetadata | null = useMemo(() => {
    if (!data) return null;
    const rv = data.ruleset_version;
    const ih = data.inputs_hash;
    const ts = data.timestamp;

    if (typeof rv !== "string" || typeof ih !== "string" || typeof ts !== "string") {
      return null;
    }

    return {
      ruleset_version: rv,
      inputs_hash: ih,
      timestamp: ts,
    };
  }, [data]);

  const hasResult = !!data;

  return (
    <>
      {/* Form */}
      <section className="w-full border border-zinc-200 rounded-lg p-5 bg-white">
        <h1 className="text-lg font-semibold">Score</h1>
        <p className="mt-2 text-sm text-zinc-700">
          Décision finale et scoring. Affichage strict du verdict ATLAS.
        </p>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="border border-zinc-100 rounded-md p-3">
            <div className="text-xs text-zinc-500">site_id</div>
            <input
              className="mt-1 w-full border border-zinc-200 rounded-md px-3 py-2 text-sm"
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
            />
          </div>

          <div className="border border-zinc-100 rounded-md p-3">
            <div className="text-xs text-zinc-500">primary_keyword</div>
            <input
              className="mt-1 w-full border border-zinc-200 rounded-md px-3 py-2 text-sm"
              value={primaryKeyword}
              onChange={(e) => setPrimaryKeyword(e.target.value)}
            />
          </div>

          <div className="border border-zinc-100 rounded-md p-3">
            <div className="text-xs text-zinc-500">primary_intent</div>
            <select
              className="mt-1 w-full border border-zinc-200 rounded-md px-3 py-2 text-sm bg-white"
              value={primaryIntent}
              onChange={(e) => setPrimaryIntent(e.target.value as Intent)}
            >
              <option value="informational">informational</option>
              <option value="comparative">comparative</option>
              <option value="transactional">transactional</option>
              <option value="navigational">navigational</option>
              <option value="support">support</option>
            </select>
          </div>

          <div className="border border-zinc-100 rounded-md p-3 md:col-span-2">
            <div className="text-xs text-zinc-500">title</div>
            <input
              className="mt-1 w-full border border-zinc-200 rounded-md px-3 py-2 text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="border border-zinc-100 rounded-md p-3 md:col-span-2">
            <div className="text-xs text-zinc-500">content</div>
            <textarea
              className="mt-1 w-full border border-zinc-200 rounded-md px-3 py-2 text-sm min-h-[160px]"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={onRun}
            disabled={loading}
            className="px-4 py-2 rounded-md border border-zinc-300 text-sm font-medium hover:bg-zinc-50 disabled:opacity-60"
          >
            {loading ? "Exécution…" : "Calculer le score"}
          </button>

          <span className="text-xs text-zinc-500">
            Endpoint : <span className="font-mono">/v1/atlas/score</span>
          </span>
        </div>
      </section>

      {/* Result */}
      {hasResult ? (
        <section className="w-full border border-zinc-200 rounded-lg p-5 bg-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-zinc-500">
                Décision
              </div>
              <div className="mt-2">
                {decision ? (
                  <DecisionBadge decision={decision} />
                ) : (
                  <span className="text-sm text-zinc-600">—</span>
                )}
              </div>

              {typeof scoreTotal !== "undefined" ? (
                <div className="mt-4">
                  <div className="text-xs uppercase tracking-wider text-zinc-500">
                    Score total
                  </div>
                  <div className="mt-1 text-xl font-semibold text-zinc-900">
                    {scoreTotal}
                  </div>
                </div>
              ) : null}
            </div>

            {metadata ? (
              <div className="min-w-[320px]">
                <MetadataBlock metadata={metadata} />
              </div>
            ) : null}
          </div>

          {dims ? (
            <div className="mt-5">
              <div className="text-xs uppercase tracking-wider text-zinc-500">
                Dimensions (A–F)
              </div>
              <div className="mt-3 grid grid-cols-2 md:grid-cols-6 gap-2">
                {["A", "B", "C", "D", "E", "F"].map((k) => (
                  <div key={k} className="border border-zinc-100 rounded-md p-3">
                    <div className="text-xs text-zinc-500">{k}</div>
                    <div className="mt-1 text-lg font-semibold text-zinc-900">
                      {dims?.[k] ?? "—"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {flags.length ? (
            <div className="mt-5 border border-zinc-100 rounded-md p-4">
              <div className="text-xs uppercase tracking-wider text-zinc-500">
                Flags
              </div>
              <div className="mt-3 space-y-2">
                {flags.map((f, i) => (
                  <div
                    key={`${f.code}-${i}`}
                    className="flex items-start justify-between gap-3 border border-zinc-100 rounded-md p-3"
                  >
                    <div>
                      <div className="text-sm font-medium text-zinc-900">
                        {f.code}
                      </div>
                      {f.gate ? (
                        <div className="mt-1 text-xs text-zinc-600">
                          Gate: {f.gate}
                        </div>
                      ) : null}
                    </div>
                    <SeverityPill severity={f.severity} />
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-5">
            <ReasonsList reasons={reasons as any} />
          </div>

          <details className="mt-5">
            <summary className="text-xs text-zinc-600 cursor-pointer select-none">
              Voir la réponse brute (debug)
            </summary>
            <pre className="mt-2 text-xs whitespace-pre-wrap border border-zinc-100 rounded-md p-3 bg-zinc-50">
              {JSON.stringify(data, null, 2)}
            </pre>
          </details>
        </section>
      ) : null}

      {errorText ? (
        <section className="w-full border border-zinc-200 rounded-lg p-5 bg-white">
          <div className="text-sm font-semibold text-zinc-900">Erreur API</div>
          <pre className="mt-3 text-xs whitespace-pre-wrap border border-zinc-100 rounded-md p-3 bg-zinc-50">
            {errorText}
          </pre>
        </section>
      ) : null}
    </>
  );
}
