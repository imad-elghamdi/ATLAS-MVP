export function AllowedActions({
  actions,
  note,
}: {
  actions: { label: string; href: string }[];
  note?: string;
}) {
  return (
    <section className="w-full border border-zinc-200 rounded-lg p-5 bg-white">
      <h2 className="text-sm font-semibold text-zinc-900">Actions autorisées</h2>

      <div className="mt-4 flex flex-col gap-2">
        {actions.map((a, i) => (
          <a
            key={i}
            href={a.href}
            className="inline-flex w-fit px-4 py-2 rounded-md border border-zinc-300 text-sm font-medium text-zinc-900 bg-white hover:bg-zinc-50"
          >
            {a.label}
          </a>
        ))}
      </div>

      {note ? <p className="mt-4 text-sm text-zinc-700">{note}</p> : null}
    </section>
  );
}
