import { Play, Plus } from "lucide-react";
import { Link } from "react-router";
import { CourseCard } from "../components/CourseCard";
import { Button, Centered, ErrorBox, Notice, Page, Spinner } from "../components/ui";
import { useConfig, useCourses, useExplore } from "../hooks";

export function LibraryPage() {
  const courses = useCourses();
  const config = useConfig();

  return (
    <Page
      title="Мои курсы"
      action={
        <Button to="/new">
          <Plus size={16} /> Создать
        </Button>
      }
    >
      {config.data && config.data.provider !== "claude" && (
        <div className="mb-4">
          <Notice>
            {config.data.provider === "none"
              ? "Режим без LLM: уроки собираются extractive-выжимкой из материала, без квизов."
              : `Мок-режим: сценарии пишет локальная ${config.data.model}. Качество ниже, чем у Claude.`}
          </Notice>
        </div>
      )}
      {courses.isPending && (
        <Centered>
          <Spinner />
        </Centered>
      )}
      {courses.error && <ErrorBox>{courses.error.message}</ErrorBox>}
      {courses.data?.length === 0 && (
        <Centered>
          <div className="text-5xl">🎬</div>
          <div className="text-lg font-bold text-text">Пока пусто</div>
          <p className="max-w-xs text-sm">Загрузи конспект, лекцию или главу учебника — получишь ленту коротких роликов с озвучкой и квизами.</p>
          <Button to="/new">Создать первый курс</Button>
        </Centered>
      )}
      {(() => {
        const cont = courses.data?.find((c) => c.status === "ready" && c.progress && c.progress.completed > 0 && c.progress.completed < c.lessonsReady);
        return cont ? (
          <Link to={`/c/${cont.id}`} className="mb-4 flex items-center gap-4 rounded-2xl border border-accent/40 bg-accent/10 p-4 hover:bg-accent/15">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-white">
              <Play size={18} fill="currentColor" />
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-bold uppercase tracking-widest text-accent">Продолжить</span>
              <span className="block truncate font-bold">{cont.title}</span>
              <span className="block text-xs text-muted">
                Урок {cont.progress!.completed + 1} из {cont.lessonsReady}
              </span>
            </span>
          </Link>
        ) : null;
      })()}
      <div className="grid gap-3 sm:grid-cols-2">{courses.data?.map((c) => <CourseCard key={c.id} course={c} />)}</div>
    </Page>
  );
}

export function ExplorePage() {
  const explore = useExplore();
  return (
    <Page title="Публичные курсы">
      {explore.isPending && (
        <Centered>
          <Spinner />
        </Centered>
      )}
      {explore.error && <ErrorBox>{explore.error.message}</ErrorBox>}
      {explore.data?.length === 0 && (
        <Centered>
          <div className="text-5xl">🌍</div>
          <p className="max-w-xs text-sm">Публичных курсов ещё нет. Сделай свой курс публичным в его настройках — он появится здесь.</p>
        </Centered>
      )}
      <div className="grid gap-3 sm:grid-cols-2">{explore.data?.map((c) => <CourseCard key={c.id} course={c} showOwner />)}</div>
    </Page>
  );
}
