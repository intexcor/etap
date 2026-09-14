import { useQueryClient } from "@tanstack/react-query";
import { Flame, LogOut } from "lucide-react";
import { useState } from "react";
import { api } from "../api";
import { plural } from "../components/CourseCard";
import { Button, Card, Centered, Input, Page, Spinner } from "../components/ui";
import { useConfig, useLogout, useMe, useStats } from "../hooks";

export function ProfilePage() {
  const me = useMe();
  const stats = useStats();
  const config = useConfig();
  const logout = useLogout();
  const qc = useQueryClient();
  const [name, setName] = useState<string | null>(null);

  if (!me.data) return null;
  const s = stats.data;
  const accuracy = s && s.answered ? Math.round((s.correct / s.answered) * 100) : null;
  const max = Math.max(1, ...(s?.days.map((d) => d.lessons + d.answers) ?? [1]));

  return (
    <Page
      title="Профиль"
      action={
        <Button variant="ghost" onClick={() => logout.mutate()}>
          <LogOut size={16} /> Выйти
        </Button>
      }
    >
      <Card className="mb-4 flex items-center gap-4">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-accent/20 text-xl font-extrabold text-accent">
          {me.data.name.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          {name === null ? (
            <button className="truncate text-lg font-bold hover:text-accent" onClick={() => setName(me.data!.name)} title="Изменить имя">
              {me.data.name}
            </button>
          ) : (
            <form
              className="flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                const user = await api.updateMe({ name });
                qc.setQueryData(["me"], user);
                setName(null);
              }}
            >
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus />
              <Button>Ок</Button>
            </form>
          )}
          <div className="truncate text-sm text-muted">{me.data.email}</div>
        </div>
      </Card>

      {!s ? (
        <Centered>
          <Spinner />
        </Centered>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Серия" value={`${s.streakDays}`} hint={plural(s.streakDays, "день", "дня", "дней")} icon={<Flame className="text-warn" size={18} />} />
            <Stat label="Уроков пройдено" value={`${s.lessonsCompleted}`} />
            <Stat label="Точность" value={accuracy === null ? "—" : `${accuracy}%`} hint={s.answered ? `${s.correct}/${s.answered}` : "нет ответов"} />
            <Stat label="К повторению" value={`${s.dueToday}`} hint="сегодня" />
          </div>
          <Card>
            <div className="mb-3 text-sm font-semibold">Активность за 14 дней</div>
            <div className="flex h-24 items-end gap-1">
              {s.days.map((d) => {
                const total = d.lessons + d.answers;
                return (
                  <div key={d.date} className="flex flex-1 flex-col items-center gap-1" title={`${d.date}: ${d.lessons} уроков, ${d.answers} ответов`}>
                    <div className="w-full rounded-t bg-accent/80" style={{ height: `${Math.max(total ? 8 : 2, (total / max) * 80)}px`, opacity: total ? 1 : 0.3 }} />
                  </div>
                );
              })}
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-muted">
              <span>{s.days[0]?.date.slice(5)}</span>
              <span>сегодня</span>
            </div>
          </Card>
        </>
      )}

      {config.data && (
        <p className="mt-6 text-xs text-muted">
          Генерация: {config.data.model}
          {config.data.provider === "local" && " (локальный мок)"}
        </p>
      )}
    </Page>
  );
}

const Stat = ({ label, value, hint, icon }: { label: string; value: string; hint?: string; icon?: React.ReactNode }) => (
  <Card className="!p-3">
    <div className="flex items-center gap-1.5 text-xs text-muted">
      {icon} {label}
    </div>
    <div className="mt-1 text-2xl font-extrabold">{value}</div>
    {hint && <div className="text-xs text-muted">{hint}</div>}
  </Card>
);
