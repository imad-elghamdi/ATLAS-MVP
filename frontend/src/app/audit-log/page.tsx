import { DecisionBadge } from "@/components/DecisionBadge";
import { MetadataBlock } from "@/components/MetadataBlock";

async function getEvents() {
  const res = await fetch("http://localhost:3000/api/atlas/v1/atlas/events", {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

export default async function AuditLogPage() {
  const data = await getEvents();

  const events: any[] = data?.events || data || [];

  return (
    <>
      <section className="w-full border border-zinc-200 rounded-lg p-5 bg-white">
        <h1 className="text-lg font-semibold">Audit log — Historique ATLAS</h1>
        <p className="mt-2 text-sm text-zinc-700">
          Timeline immutable. Chaque décision est versionnée et traçable.
        </p>
      </section>

      <section className="w-full border border-zinc-200 rounded-lg p-5 bg-white">
        <h2 className="text-sm font-semibold text-zinc-900">Events</h2>

        {!data ? (
          <p className="mt-3 text-sm text-zinc-700">
            Aucun event disponible (ou backend non accessible).
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {events.map((e, i) => (
              <div key={e.id || i} className="border border-zinc-100 rounded-md p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="text-sm">
                    <div className="font-semibold text-zinc-900">
                      {e.type || e.event_type || "EVENT"}
                    </div>
                    <div className="mt-1 text-zinc-700">
                      {e.timestamp || e.date || e.created_at || "—"}
                    </div>
                  </div>

                  {e.decision ? <DecisionBadge decision={e.decision} /> : null}
                </div>

                {e.metadata ? (
                  <div className="mt-3">
                    <MetadataBlock metadata={e.metadata} />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
