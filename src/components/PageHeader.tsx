export function PageHeader({
  eyebrow,
  title,
  description,
  action
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 border-b border-hope-100 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-hope-700">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-bold text-ink-900 sm:text-4xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-500">{description}</p>
      </div>
      {action}
    </div>
  );
}
