import type { ComponentProps, ReactNode } from "react";

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium tracking-wide text-zinc-700 dark:text-zinc-300">{label}</span>
      {children}
      {hint && !error && <span className="text-xs text-zinc-500">{hint}</span>}
      {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
    </label>
  );
}

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-base outline-none focus:border-gold-500 focus:ring-2 focus:ring-gold-400/25 dark:focus:border-gold-400 dark:border-zinc-700 dark:bg-zinc-900";

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function Select(props: ComponentProps<"select">) {
  return <select {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function Textarea(props: ComponentProps<"textarea">) {
  return <textarea {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function Button({ variant = "primary", ...props }: ComponentProps<"button"> & { variant?: "primary" | "secondary" }) {
  return <button {...props} className={`${variant === "primary" ? "btn-gold" : "btn-quiet"} ${props.className ?? ""}`} />;
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/60 dark:text-red-200">
      {message}
    </p>
  );
}
