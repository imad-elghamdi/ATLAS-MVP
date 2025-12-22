import { AtlasMetadata } from "@/lib/types";

export function MetadataBlock({ metadata }: { metadata: AtlasMetadata }) {
  return (
    <section className="w-full border border-zinc-200 rounded-lg p-5 bg-white">
      <h2 className="text-sm font-semibold text-zinc-900">Métadonnées</h2>
      <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-zinc-800">
        <div>
          <div className="text-xs text-zinc-500">Ruleset</div>
          <div className="font-medium">{metadata.ruleset_version}</div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">Inputs hash</div>
          <div className="font-medium">{metadata.inputs_hash}</div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">Timestamp</div>
          <div className="font-medium">{metadata.timestamp}</div>
        </div>
      </div>
    </section>
  );
}
