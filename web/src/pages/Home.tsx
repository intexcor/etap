import { useQuery } from "@tanstack/react-query";
import { Play, Upload } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { api } from "../api";
import { CourseCard } from "../components/CourseCard";
import { CardGrid, LessonCard, LessonPoster } from "../components/LessonCard";
import { Centered, ErrorBox, Spinner } from "../components/ui";
import { useConfig, useMe } from "../hooks";

const Section = ({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) => (
  <section className="mb-8">
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-lg font-extrabold">{title}</h2>
      {action}
    </div>
    {children}
  </section>
);

export function HomePage() {
  const me = useMe();
  const config = useConfig();
  const home = useQuery({ queryKey: ["home", me.data?.id ?? "guest"], queryFn: api.home });

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-5">
      {!me.data && (
        <div className="mb-6 flex flex-col items-start gap-3 rounded-3xl border border-line bg-[radial-gradient(circle_at_10%_0%,rgba(139,108,255,0.25),transparent_50%)] bg-panel p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight md:text-3xl">Учись так, как листаешь ленту</h1>
            <p className="mt-1 max-w-xl text-sm text-muted">
              Загрузи конспект или PDF — ETAP разберёт его на короткие ролики с озвучкой, формулами и вопросами. Что не запомнилось, вернётся само.
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/register" className="rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white">
              Начать
            </Link>
            <Link to="/feed" className="rounded-xl border border-line px-5 py-2.5 text-sm font-semibold">
              Смотреть ленту
            </Link>
          </div>
        </div>
      )}
      {config.data && config.data.provider !== "claude" && me.data && (
        <p className="mb-4 text-xs text-muted">
          Генерация: {config.data.provider === "none" ? "без LLM, extractive" : `локальная ${config.data.model}`}.
        </p>
      )}

      {home.isPending && (
        <Centered>
          <Spinner />
        </Centered>
      )}
      {home.error && <ErrorBox>{home.error.message}</ErrorBox>}
      {home.data && (
        <>
          {home.data.continue && (
            <Link
              to={`/c/${home.data.continue.course.id}#${home.data.continue.lesson.id}`}
              className="mb-8 flex items-center gap-4 rounded-3xl border border-accent/40 bg-accent/10 p-3 pr-5 hover:bg-accent/15"
            >
              <LessonPoster lesson={home.data.continue.lesson} className="h-28 w-16 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold uppercase tracking-widest text-accent">Продолжить</div>
                <div className="truncate text-lg font-bold">{home.data.continue.lesson.title}</div>
                <div className="truncate text-sm text-muted">
                  {home.data.continue.course.title} · урок {home.data.continue.lesson.position + 1} из {home.data.continue.course.lessonsReady}
                </div>
              </div>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-white">
                <Play size={18} fill="currentColor" />
              </span>
            </Link>
          )}

          {home.data.mine.length > 0 && (
            <Section
              title="Из твоих курсов"
              action={
                <Link to="/library" className="text-sm text-accent">
                  Все курсы →
                </Link>
              }
            >
              <CardGrid>
                {home.data.mine.map((l) => (
                  <LessonCard key={l.id} lesson={l} />
                ))}
              </CardGrid>
            </Section>
          )}

          <Section
            title="Новое"
            action={
              <Link to="/feed" className="text-sm text-accent">
                Смотреть лентой →
              </Link>
            }
          >
            {home.data.latest.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">
                Публичных уроков пока нет.{" "}
                <Link to="/new" className="text-accent">
                  Загрузи материал
                </Link>{" "}
                и сделай курс публичным.
              </div>
            ) : (
              <CardGrid>
                {home.data.latest.map((l) => (
                  <LessonCard key={l.id} lesson={l} />
                ))}
              </CardGrid>
            )}
          </Section>

          {home.data.courses.length > 0 && (
            <Section title="Курсы">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {home.data.courses.map((c) => (
                  <CourseCard key={c.id} course={c} showOwner />
                ))}
              </div>
            </Section>
          )}

          {me.data && (
            <Link to="/new" className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-line p-5 text-sm text-muted hover:border-accent hover:text-text">
              <Upload size={16} /> Загрузить свой материал
            </Link>
          )}
        </>
      )}
    </div>
  );
}

export function SearchPage() {
  const [params] = useSearchParams();
  const query = params.get("q") ?? "";
  const results = useQuery({ queryKey: ["search", query], queryFn: () => api.search(query), enabled: query.length >= 2 });
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-5">
      <h1 className="mb-4 text-xl font-extrabold">
        {query ? `«${query}»` : "Поиск"}
        {results.data && <span className="ml-2 text-sm font-normal text-muted">{results.data.length} уроков</span>}
      </h1>
      {results.isPending && query && (
        <Centered>
          <Spinner />
        </Centered>
      )}
      {results.error && <ErrorBox>{results.error.message}</ErrorBox>}
      {results.data?.length === 0 && <p className="text-muted">Ничего не нашлось. Ищем по названиям уроков и тексту материалов.</p>}
      {results.data && (
        <CardGrid>
          {results.data.map((l) => (
            <LessonCard key={l.id} lesson={l} />
          ))}
        </CardGrid>
      )}
    </div>
  );
}
