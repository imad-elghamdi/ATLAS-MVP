"use client";

import { useState } from "react";
import { DecisionBadge } from "@/components/DecisionBadge";
import { ReasonsList } from "@/components/ReasonsList";
import { MetadataBlock } from "@/components/MetadataBlock";

const DEV_SITE_ID = "7695f038-93bd-4017-b64a-78b5a22ddad4";

type Intent = "informational" | "comparative" | "transactional" | "navigational" | "support";

export default function PrecheckPage() {
  const [siteId, setSiteId] = useState(DEV_SITE_ID);
  const [primaryKeyword, setPrimaryKeyword] = useState("van aménagé");
  const [primaryIntent, setPrimaryIntent] = useState<Intent>("informational");
  const [loading, setLoading] = useState(false);

  const [data, setData] = useState<any>(null);
  const [errorText, setErrorText] = useState<string>("");

  async function onRun() {
    setLoading(true);
    setErrorText("");
    setData(null);

    try {
      const res = await fetch("/api/atlas/v1/atlas/precheck", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          site_id: siteId,
          primary_keyword: primaryKeyword,
          primary_intent: primaryIntent,
        }),
      });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        setErrorText(t || `HTTP ${res.status}`);
        return;
      }

      const json = await res.json();
      setData(json);
    } catch (e: any) {
      setErrorText(e?.message || "Request failed");
    } finally {
      setLoading(false);
    }
  }

  // Backend schema (v1)
  const decision = data?.decision;
  const gates = Array.isArray(data?.gates) ? data.gates : [];

  const metadata = {
    ruleset_version: data?.ruleset_version || data?.ruleset,
    inputs_hash: data?.inputs_hash,
    timestamp: data?.timestamp,
    topic_key: data?.topic_key,
  };

  return (
    <>
      <section className="w-full border border-zinc-200 rounded-lg p-5 bg-white">
        <h1 className="text-lg font-semibold">Precheck (G0–G3)</h1>
        <p className="mt-2 text-sm text-zinc-700">
          Filtre avant génération. Résultat non contournable.
        </p>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="border border-zinc-100 rounded-md p-3">
            <div className="text-xs text-zinc-500">site_id</div>
            <input
              className="mt-1 w-full border border-zinc-200 rounded-md px-3 py-2 text-sm"
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
              placeholder="ex: 7695f038-..."
            />
          </div>

          <div className="border border-zinc-100 rounded-md p-3 md:col-span-2">
            <div className="text-xs text-zinc-500">primary_keyword</div>
            <input
              className="mt-1 w-full border border-zinc-200 rounded-md px-3 py-2 text-sm"
              value={primaryKeyword}
              onChange={(e) => setPrimaryKeyword(e.target.value)}
              placeholder="ex: van aménagé"
            />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
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

          <div className="md:col-span-2 flex items-end">
            <button
              onClick={onRun}
              disabled={loading}
              className="px-4 py-2 rounded-md border border-zinc-300 text-sm font-medium hover:bg-zinc-50 disabled:opacity-60"
            >
              {loading ? "Exécution…" : "Lancer le precheck"}
            </button>
          </div>
        </div>
      </section>

      {errorText ? (
        <section className="w-full border border-zinc-200 rounded-lg p-5 bg-white">
          <div className="text-sm font-semibold text-zinc-900">Erreur API</div>
          <pre className="mt-3 text-xs whitespace-pre-wrap border border-zinc-100 rounded-md p-3 bg-zinc-50">
            {errorText}
          </pre>
        </section>
      ) : null}

      {decision ? (
        <section className="w-full border border-zinc-200 rounded-lg p-5 bg-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-zinc-500">
                Décision globale
              </div>
              <div className="mt-2">
                <DecisionBadge decision={decision} />
              </div>
            </div>

            <div className="min-w-[320px]">
              <MetadataBlock metadata={metadata} />
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {gates.map((g: any) => (
              <div key={g.gate} className="border border-zinc-200 rounded-lg p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-zinc-900">{g.gate}</div>
                  <DecisionBadge decision={g.decision} />
                </div>

                <div className="mt-3">
                  <ReasonsList reasons={g.reasons || []} />
                </div>

                {Array.isArray(g.flags) && g.flags.length > 0 ? (
                  <div className="mt-3 text-xs text-zinc-700">
                    <div className="text-xs uppercase tracking-wider text-zinc-500">Flags</div>
                    <ul className="mt-2 list-disc pl-5">
                      {g.flags.map((f: any, i: number) => (
                        <li key={i}>
                          <span className="font-medium">{f.code}</span> — {f.severity}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
