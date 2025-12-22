import { DecisionBadge } from "@/components/DecisionBadge";

const DEV_WORKSPACE_ID = "11111111-1111-1111-1111-111111111111";
const DEV_CMS_TYPE = "wordpress";

async function getRulesetCurrent() {
  const res = await fetch("http://localhost:3000/api/atlas/v1/rulesets/current", {
    cache: "no-store",
  });
  return res.ok ? res.json() : null;
}

async function upsertSite() {
  const res = await fetch("http://localhost:3000/api/atlas/v1/sites", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ workspace_id: DEV_WORKSPACE_ID, cms_type: DEV_CMS_TYPE }),
    cache: "no-store",
  });
  if (!res.ok) return { errorText: await res.text().catch(() => "") };
  return res.json();
}

export default async function SitesPage() {
  const ruleset = await getRulesetCurrent();
  const siteResp: any = await upsertSite();

  const site = siteResp?.id ? siteResp : null;

  return (
    <>
      <section className="w-full border border-zinc-200 rounded-lg p-5 bg-white">
        <h1 className="text-lg font-semibold">Sites</h1>
        <p className="mt-2 text-sm text-zinc-700">
          Contexte du site connecté. ATLAS applique les politiques actives et le ruleset courant.
        </p>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="border border-zinc-100 rounded-md p-4">
            <div className="text-xs uppercase tracking-wider text-zinc-500">Ruleset backend</div>
            <div className="mt-1 font-medium text-zinc-900">
              {ruleset ? `${ruleset.active} (v${ruleset.ruleset?.version || "n/a"})` : "Non disponible"}
            </div>
          </div>

          <div className="border border-zinc-100 rounded-md p-4">
            <div className="text-xs uppercase tracking-wider text-zinc-500">Workspace</div>
            <div className="mt-1 font-medium text-zinc-900">{DEV_WORKSPACE_ID}</div>
            <div className="mt-1 text-xs text-zinc-500">cms_type : {DEV_CMS_TYPE}</div>
          </div>
        </div>
      </section>

      <section className="w-full border border-zinc-200 rounded-lg p-5 bg-white">
        <h2 className="text-sm font-semibold text-zinc-900">Site (dev)</h2>

        {!site ? (
          <div className="mt-3 text-sm text-zinc-800">
            <div className="font-medium">Aucune donnée site retournée.</div>
            {siteResp?.errorText ? (
              <pre className="mt-3 text-xs whitespace-pre-wrap border border-zinc-100 rounded-md p-3 bg-zinc-50">
                {siteResp.errorText}
              </pre>
            ) : null}
          </div>
        ) : (
          <div className="mt-4 border border-zinc-100 rounded-md p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="text-sm">
                <div className="font-semibold text-zinc-900">Site ID</div>
                <div className="mt-1 text-zinc-700">{site.id}</div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-zinc-500">CMS</div>
                    <div className="font-medium">{site.cms_type}</div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500">Locale</div>
                    <div className="font-medium">{site.locale}</div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500">Timezone</div>
                    <div className="font-medium">{site.timezone}</div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500">SEO Plugin</div>
                    <div className="font-medium">{site.seo_plugin ?? "—"}</div>
                  </div>
                </div>
              </div>

              {/* si un jour le backend renvoie last_verdict */}
              {site.last_verdict ? <DecisionBadge decision={site.last_verdict} /> : null}
            </div>

            <div className="mt-4">
              <div className="text-xs uppercase tracking-wider text-zinc-500">Policies</div>
              <pre className="mt-2 text-xs whitespace-pre-wrap border border-zinc-100 rounded-md p-3 bg-zinc-50">
                {JSON.stringify(site.policies ?? {}, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
