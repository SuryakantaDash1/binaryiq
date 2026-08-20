export function Article({
  title,
  updated,
  children,
}: {
  title: string;
  updated?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <article>
      <h1 className="text-3xl font-black text-gray-900">{title}</h1>
      {updated && <p className="mt-1 text-xs text-gray-400">Last updated: {updated}</p>}
      <div className="mt-6 space-y-5 text-sm leading-relaxed text-gray-700">{children}</div>
    </article>
  );
}

export function Section({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold text-gray-900">{heading}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
