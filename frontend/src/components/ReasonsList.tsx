import { AtlasReason } from "@/lib/types";

export function ReasonsList({ reasons }: { reasons: AtlasReason[] }) {
  return (
    <section className="w-full border border-zinc-200 rounded-lg p-5 bg-white">
      <h2 className="text-sm font-semibold text-zinc-900">Raisons</h2>
      <ul className="mt-3 space-y-2 text-sm text-zinc-800 list-disc pl-5">
        {reasons.map((r, i) => (
          <li key={i}>{r.message}</li>
        ))}
      </ul>
    </section>
  );
}
