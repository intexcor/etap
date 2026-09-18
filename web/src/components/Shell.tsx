// Единая оболочка: шапка с поиском, слева меню и список курсов, справа контент (в т.ч. плеер);
// на телефоне — нижняя панель вкладок.
import { Clock, History, Home, Library, Menu, Play, Plus, Search, User } from "lucide-react";
import { Avatar } from "./LessonCard";
import { useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useNavigate, useSearchParams } from "react-router";
import { useCourses, useMe, useReview } from "../hooks";

const nav = [
  { to: "/", label: "Главная", icon: Home, end: true },
  { to: "/feed", label: "Лента", icon: Play },
  { to: "/library", label: "Мои курсы", icon: Library },
  { to: "/review", label: "Повтор", icon: History },
  { to: "/profile", label: "Профиль", icon: User },
];

/** Знак — три ступени: этап за этапом. */
export const Mark = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M3 20h6v-6h6V8h6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Logo = () => (
  <Link to="/" className="flex items-center gap-1.5 text-[19px] font-extrabold tracking-tight text-text">
    <span className="text-accent">
      <Mark />
    </span>
    ETAP
  </Link>
);

export function Shell({ children }: { children?: ReactNode }) {
  const me = useMe();
  const review = useReview();
  const courses = useCourses();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [wide, setWide] = useState(true);
  const due = me.data ? (review.data?.dueCount ?? 0) : 0;
  const search = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim().length >= 2) navigate(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 bg-bg px-4">
        <button onClick={() => setWide((w) => !w)} className="yt-icon hidden md:grid" aria-label="Меню">
          <Menu size={22} />
        </button>
        <Logo />
        <form onSubmit={search} className="mx-auto hidden h-10 w-full max-w-[560px] items-center gap-2 rounded-full border border-line bg-[#141414] px-4 focus-within:border-accent sm:flex">
          <Search size={18} className="shrink-0 text-muted" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Найти урок или тему" className="w-full bg-transparent text-[15px] outline-none placeholder:text-muted" />
        </form>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Link to="/search" className="yt-icon sm:hidden" aria-label="Поиск">
            <Search size={22} />
          </Link>
          <Link to="/new" className="yt-pill yt-pill-primary">
            <Plus size={18} /> <span className="hidden sm:inline">Загрузить</span>
          </Link>
          {me.data ? (
            <Link to="/profile" title={me.data.name}>
              <Avatar name={me.data.name} size={32} />
            </Link>
          ) : (
            <Link to="/login" className="yt-pill">
              Войти
            </Link>
          )}
        </div>
      </header>

      <div className="flex flex-1">
        <aside className={`sticky top-14 hidden h-[calc(100dvh-3.5rem)] shrink-0 flex-col overflow-y-auto no-scrollbar md:flex ${wide ? "w-60 px-3" : "w-[72px] px-1"}`}>
          <nav className="flex flex-col gap-0.5 py-2">
            {nav.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  wide
                    ? `flex h-10 items-center gap-5 rounded-[10px] px-3 text-sm ${isActive ? "bg-chip font-medium" : "hover:bg-chip"}`
                    : `flex flex-col items-center gap-1.5 rounded-[10px] py-3 text-[10px] ${isActive ? "font-medium" : ""} hover:bg-chip`
                }
              >
                <t.icon size={wide ? 22 : 24} strokeWidth={1.6} />
                {t.label}
                {t.to === "/review" && due > 0 && wide && <span className="ml-auto rounded-full bg-accent px-1.5 text-[11px] font-bold text-white">{due}</span>}
              </NavLink>
            ))}
          </nav>
          {wide && me.data && (courses.data?.length ?? 0) > 0 && (
            <>
              <div className="my-2 border-t border-line" />
              <div className="px-3 pb-1 pt-2 text-base font-medium">Курсы</div>
              <nav className="flex flex-col gap-0.5">
                {courses.data!.slice(0, 8).map((c) => (
                  <NavLink key={c.id} to={`/c/${c.id}`} className={({ isActive }) => `flex h-10 items-center gap-4 rounded-[10px] px-3 text-sm hover:bg-chip ${isActive ? "bg-chip font-medium" : ""}`}>
                    <Avatar name={c.title} size={24} />
                    <span className="truncate">{c.title}</span>
                    {c.status !== "ready" && <Clock size={12} className="ml-auto shrink-0 text-muted" />}
                  </NavLink>
                ))}
              </nav>
            </>
          )}
          {wide && (
            <>
              <div className="my-2 border-t border-line" />
              <Link to="/new" className="flex h-10 items-center gap-5 rounded-[10px] px-3 text-sm hover:bg-chip">
                <Plus size={22} strokeWidth={1.6} /> Загрузить материал
              </Link>
              <p className="mt-auto px-3 py-4 text-xs text-muted">© {new Date().getFullYear()} ETAP</p>
            </>
          )}
        </aside>

        <main className="min-w-0 flex-1 pb-16 md:pb-0">{children ?? <Outlet />}</main>
      </div>

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-bg md:hidden">
        {nav.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) => `relative flex flex-col items-center gap-0.5 py-1.5 text-[10px] ${isActive ? "font-medium" : "text-muted"}`}
          >
            <t.icon size={24} strokeWidth={1.6} />
            {t.label}
            {t.to === "/review" && due > 0 && <span className="absolute right-1/4 top-0.5 rounded-full bg-accent px-1.5 text-[10px] font-bold text-white">{due}</span>}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
