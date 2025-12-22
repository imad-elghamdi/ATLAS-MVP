import { Decision } from "@/lib/types";
import { DecisionBadge } from "./DecisionBadge";

export function DecisionPanel({
  title,
  decision,
  subtitle,
}: {
  title: string;
  decision: Decision;
  subtitle?: string;
}) {
  return (
    <section className="w-full border border-zinc-200 rounded-lg p-5 bg-white">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">{title}</h1>
          {subtitle ? <p className="mt-2 text-sm text-zinc-700">{subtitle}</p> : null}
        </div>
        <DecisionBadge decision={decision} />
      </div>
    </section>
  );
}
