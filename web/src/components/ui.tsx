import type { ReactNode } from "react";
import { Link } from "react-router";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger"; to?: string };

const base = "inline-flex h-9 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition disabled:opacity-40 disabled:pointer-events-none";
const variants = {
  primary: "bg-text text-bg hover:bg-[#d9d9d9]",
  ghost: "bg-chip text-text hover:bg-panel-2",
  danger: "bg-chip text-bad hover:bg-panel-2",
};

export function Button({ variant = "primary", className = "", to, children, ...rest }: ButtonProps) {
  const cls = `${base} ${variants[variant]} ${className}`;
  if (to) {
    return (
      <Link to={to} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  );
}

export const Card = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <div className={`rounded-xl bg-panel p-4 ${className}`}>{children}</div>
);

export const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    className={`w-full rounded-lg border border-line bg-[#121212] px-3.5 py-2.5 text-sm text-text outline-none placeholder:text-muted focus:border-accent-2 ${props.className ?? ""}`}
  />
);

export const Select = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    {...props}
    className={`rounded-lg border border-line bg-[#121212] px-3 py-2.5 text-sm text-text outline-none focus:border-accent-2 ${props.className ?? ""}`}
  />
);

export const Spinner = ({ className = "" }: { className?: string }) => <div className={`spinner ${className}`} />;

export const ErrorBox = ({ children }: { children: ReactNode }) => (
  <div className="rounded-xl border border-bad/40 bg-bad/10 px-3.5 py-2.5 text-sm text-bad">{children}</div>
);

export const Notice = ({ children }: { children: ReactNode }) => (
  <div className="rounded-xl border border-warn/30 bg-warn/10 px-3.5 py-2.5 text-xs text-[#ffd48a]">{children}</div>
);

export const ProgressBar = ({ value, className = "" }: { value: number; className?: string }) => (
  <div className={`h-1.5 overflow-hidden rounded-full bg-line ${className}`}>
    <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }} />
  </div>
);

export const Centered = ({ children }: { children: ReactNode }) => (
  <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center text-muted">{children}</div>
);

export const Page = ({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) => (
  <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-6 md:pb-10">
    <div className="mb-5 flex items-center justify-between gap-3">
      <h1 className="text-2xl font-bold">{title}</h1>
      {action}
    </div>
    {children}
  </div>
);

export function formatDuration(seconds: number) {
  const s = Math.round(seconds);
  return s < 60 ? `${s} с` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function formatDue(ts: number | null) {
  if (!ts) return "";
  const diff = ts - Date.now();
  if (diff <= 0) return "пора повторить";
  const hours = Math.round(diff / 3600000);
  if (hours < 24) return `повтор через ${hours} ч`;
  const days = Math.round(hours / 24);
  return `повтор через ${days} д`;
}
