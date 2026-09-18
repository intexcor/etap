// Оболочка платформы: верхняя панель с поиском, слева навигация, снизу вкладки на телефоне.
import { Home, Library, Play, Plus, RotateCcw, Search, User } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useNavigate, useSearchParams } from "react-router";
import { useMe, useReview } from "../hooks";

const nav = [
  { to: "/", label: "Главная", icon: Home, end: true },
  { to: "/feed", label: "Лента", icon: Play },
  { to: "/library", label: "Мои курсы", icon: Library },
  { to: "/review", label: "Повтор", icon: RotateCcw },
  { to: "/profile", label: "Профиль", icon: User },
];

export const Logo = ({ className = "" }: { className?: string }) => (
  <Link to="/" className={`flex items-center gap-2 text-xl font-black tracking-tight ${className}`}>
    <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-sm text-white">E</span>
    ETAP
  </Link>
);

export function Shell({ children }: { children?: ReactNode }) {
  const me = useMe();
  const review = useReview();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const due = me.data ? (review.data?.dueCount ?? 0) : 0;

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-bg/90 px-4 backdrop-blur">
        <Logo />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (query.trim().length >= 2) navigate(`/search?q=${encodeURIComponent(query.trim())}`);
          }}
          className="mx-auto flex w-full max-w-xl items-center gap-2 rounded-full border border-line bg-panel px-3"
        >
          <Search size={16} className="shrink-0 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Искать уроки…"
            className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted/60"
          />
        </form>
        <div className="flex shrink-0 items-center gap-2">
          <Link to="/new" className="hidden items-center gap-1.5 rounded-full bg-accent px-3.5 py-2 text-sm font-semibold text-white sm:flex">
            <Plus size={16} /> Создать
          </Link>
          {me.data ? (
            <Link to="/profile" className="grid h-9 w-9 place-items-center rounded-full bg-accent/20 text-sm font-bold text-accent" title={me.data.name}>
              {me.data.name.slice(0, 1).toUpperCase()}
            </Link>
          ) : (
            <Link to="/login" className="rounded-full border border-line px-3.5 py-2 text-sm font-semibold">
              Войти
            </Link>
          )}
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-56 shrink-0 flex-col border-r border-line px-3 py-4 md:flex">
          <nav className="flex flex-col gap-1">
            {nav.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive ? "bg-accent/15 text-accent" : "text-muted hover:bg-panel-2 hover:text-text"}`
                }
              >
                <t.icon size={18} />
                {t.label}
                {t.to === "/review" && due > 0 && <span className="ml-auto rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-white">{due}</span>}
              </NavLink>
            ))}
          </nav>
          <Link to="/new" className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-dashed border-line px-3 py-2.5 text-sm text-muted hover:border-accent hover:text-text">
            <Plus size={16} /> Загрузить материал
          </Link>
        </aside>

        <main className="min-w-0 flex-1 pb-20 md:pb-0">{children ?? <Outlet />}</main>
      </div>

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-line bg-panel/95 backdrop-blur md:hidden">
        {nav.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) => `relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${isActive ? "text-accent" : "text-muted"}`}
          >
            <t.icon size={20} />
            {t.label}
            {t.to === "/review" && due > 0 && (
              <span className="absolute right-1/4 top-1 rounded-full bg-accent px-1.5 text-[10px] font-bold text-white">{due}</span>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
