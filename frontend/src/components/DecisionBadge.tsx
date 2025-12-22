import { Decision } from "@/lib/types";

export function DecisionBadge({ decision }: { decision: Decision }) {
  const styles: Record<Decision, string> = {
    BLOCK: "bg-zinc-900 text-zinc-100 border border-zinc-800",
    REVIEW: "bg-transparent text-zinc-900 border border-zinc-400",
    PASS: "bg-zinc-200 text-zinc-900 border border-zinc-300",
  };

  return (
    <span
      className={[
        "inline-flex items-center px-3 py-1 text-xs font-medium uppercase tracking-wider rounded-md",
        styles[decision],
      ].join(" ")}
    >
      {decision}
    </span>
  );
}
