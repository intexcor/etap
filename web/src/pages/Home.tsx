// Главная как YouTube: чипы-фильтры, видео-карточки курсов, полка Shorts с уроками.
import { useQuery } from "@tanstack/react-query";
import { Play } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import type { HomeData } from "../../../shared/api";
import { api } from "../api";
import { CourseVideoCard, LessonCard, LessonPoster, ShortsGrid, VideoGrid } from "../components/LessonCard";
import { Centered, ErrorBox, Spinner } from "../components/ui";
import { useMe } from "../hooks";

export function HomePage() {
  const me = useMe();
  const home = useQuery({ queryKey: ["home", me.data?.id ?? "guest"], queryFn: api.home });
  const [chip, setChip] = useState<"all" | "mine" | "new">("all");

  const posters = (d: HomeData) => new Map([...d.latest, ...d.mine].map((l) => [l.courseId, l]));

  return (
    <div className="px-4 py-3 md:px-6">
      <div className="no-scrollbar sticky top-14 z-20 -mx-4 mb-4 flex gap-3 overflow-x-auto bg-bg px-4 py-2 md:-mx-6 md:px-6">
        {(
          [
            ["all", "Все"],
            ["new", "Новое"],
            ["mine", "Мои курсы"],
          ] as const
        ).map(([k, label]) => (
          <button key={k} onClick={() => setChip(k)} className={`yt-chip ${chip === k ? "yt-chip-active" : ""}`}>
            {label}
          </button>
        ))}
      </div>

      {!me.data && (
        <div className="mb-8 flex flex-col gap-3 rounded-xl bg-panel p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-lg font-medium">Загрузи конспект или PDF — получи курс из коротких роликов</div>
            <div className="text-sm text-muted">Озвучка, формулы, код, вопросы после каждого ролика и повторения по расписанию.</div>
          </div>
          <Link to="/register" className="yt-pill yt-pill-primary shrink-0">
            Начать
          </Link>
        </div>
      )}

      {home.isPending && (
        <Centered>
          <Spinner />
        </Centered>
      )}
      {home.error && <ErrorBox>{home.error.message}</ErrorBox>}
      {home.data && (
        <>
          {home.data.continue && chip !== "new" && (
            <Link to={`/c/${home.data.continue.course.id}#${home.data.continue.lesson.id}`} className="mb-8 flex items-center gap-4 rounded-xl bg-panel p-3 pr-4 hover:bg-[#2a2a2a]">
              <LessonPoster lesson={home.data.continue.lesson} className="h-24 w-[54px] shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium uppercase tracking-wide text-muted">Продолжить просмотр</div>
                <div className="truncate text-base font-medium">{home.data.continue.lesson.title}</div>
                <div className="truncate text-sm text-muted">
                  {home.data.continue.course.title} · урок {home.data.continue.lesson.position + 1} из {home.data.continue.course.lessonsReady}
                </div>
              </div>
              <span className="yt-pill yt-pill-primary">
                <Play size={16} fill="currentColor" /> Смотреть
              </span>
            </Link>
          )}

          {chip !== "new" && (chip === "mine" ? home.data.mine.length > 0 : home.data.courses.length > 0) && (
            <VideoGrid>
              {(chip === "mine" ? [...new Map(home.data.mine.map((l) => [l.courseId, l])).keys()].map((id) => home.data!.courses.find((c) => c.id === id)).filter(Boolean) : home.data.courses).map(
                (c) => c && <CourseVideoCard key={c.id} course={c} poster={posters(home.data!).get(c.id)} />,
              )}
            </VideoGrid>
          )}

          {(chip === "all" || chip === "new") && (
            <section className="mt-10 border-t border-line pt-6">
              <div className="mb-4 flex items-center gap-2">
                <h2 className="text-xl font-bold">Свежие уроки</h2>
                <Link to="/feed" className="yt-pill ml-auto">
                  Смотреть лентой
                </Link>
              </div>
              {home.data.latest.length === 0 ? (
                <p className="text-sm text-muted">
                  Публичных уроков пока нет.{" "}
                  <Link to="/new" className="text-accent-2">
                    Загрузи материал
                  </Link>{" "}
                  и сделай курс публичным.
                </p>
              ) : (
                <ShortsGrid>
                  {home.data.latest.map((l) => (
                    <LessonCard key={l.id} lesson={l} />
                  ))}
                </ShortsGrid>
              )}
            </section>
          )}

          {chip === "mine" && home.data.mine.length === 0 && (
            <Centered>
              <p className="text-sm">У тебя пока нет курсов.</p>
              <Link to="/new" className="yt-pill yt-pill-primary">
                Загрузить материал
              </Link>
            </Centered>
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
    <div className="mx-auto max-w-[1100px] px-4 py-4 md:px-6">
      {!query && <p className="text-muted">Введите запрос в строке поиска.</p>}
      {results.isPending && query && (
        <Centered>
          <Spinner />
        </Centered>
      )}
      {results.error && <ErrorBox>{results.error.message}</ErrorBox>}
      {results.data?.length === 0 && <p className="text-muted">По запросу «{query}» ничего не найдено.</p>}
      {results.data && results.data.length > 0 && (
        <div className="flex flex-col gap-4">
          {results.data.map((l) => (
            <Link key={l.id} to={`/c/${l.courseId}#${l.id}`} className="flex gap-4 rounded-xl p-1 hover:bg-panel">
              <LessonPoster lesson={l} className="h-40 w-[90px] shrink-0 rounded-lg" />
              <div className="min-w-0 py-1">
                <div className="text-lg font-normal leading-6">{l.title}</div>
                <div className="mt-1 text-xs text-muted">
                  {l.courseTitle} · урок {l.position + 1} из {l.lessonsInCourse} · {l.owner.name}
                </div>
                <div className="mt-2 line-clamp-2 text-xs text-muted">{l.scenes[0]?.narration}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
