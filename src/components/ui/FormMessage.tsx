type FormMessageTone = "error" | "success" | "warning" | "info";

const toneClasses: Record<FormMessageTone, string> = {
  error: "border-red-200 bg-red-50 text-red-800",
  success: "border-hope-100 bg-hope-50 text-ink-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  info: "border-hope-100 bg-white text-ink-700"
};

export function FormMessage({
  children,
  tone = "error",
  id
}: {
  children: React.ReactNode;
  tone?: FormMessageTone;
  id?: string;
}) {
  if (!children) {
    return null;
  }

  return (
    <div
      id={id}
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
      className={`break-words rounded-md border px-4 py-3 text-sm font-semibold leading-relaxed ${toneClasses[tone]}`}
    >
      {children}
    </div>
  );
}
