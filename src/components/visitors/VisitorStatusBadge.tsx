const labels = { ACTIVE: "Ativo", INACTIVE: "Inativo", CONVERTED: "Convertido" } as const;
const styles = {
  ACTIVE: "bg-emerald-100 text-emerald-800",
  INACTIVE: "bg-slate-100 text-slate-700",
  CONVERTED: "bg-violet-100 text-violet-800"
} as const;

export function VisitorStatusBadge({ status }: { status: keyof typeof labels }) {
  return <span className={`rounded px-2 py-1 text-xs font-bold ${styles[status]}`}>{labels[status]}</span>;
}
