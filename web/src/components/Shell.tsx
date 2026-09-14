import { Compass, Library, Plus, RotateCcw, User } from "lucide-react";
import { NavLink, Outlet } from "react-router";
import { useMe, useReview } from "../hooks";

const tabs = [
  { to: "/", label: "Курсы", icon: Library, end: true },
  { to: "/explore", label: "Обзор", icon: Compass },
  { to: "/new", label: "Создать", icon: Plus },
  { to: "/review", label: "Повтор", icon: RotateCcw },
  { to: "/profile", label: "Профиль", icon: User },
];

export function Shell() {
  const me = useMe();
  const review = useReview();
  const due = me.data ? (review.data?.dueCount ?? 0) : 0;

  return (
    <div className="flex min-h-full">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-line bg-panel px-3 py-5 md:flex">
        <div className="mb-6 px-2 text-xl font-extrabold tracking-tight">
          Learn<span className="text-accent">Tok</span>
        </div>
        <nav className="flex flex-col gap-1">
          {tabs.map((t) => (
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
      </aside>

      <main className="min-w-0 flex-1">
        <Outlet />
      </main>

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-line bg-panel/95 backdrop-blur md:hidden">
        {tabs.map((t) => (
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
