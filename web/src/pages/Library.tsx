import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Link } from "react-router";
import { api } from "../api";
import { CourseVideoCard, VideoGrid } from "../components/LessonCard";
import { Centered, ErrorBox, Notice, Spinner } from "../components/ui";
import { useConfig, useCourses, useMe } from "../hooks";

export function LibraryPage() {
  const me = useMe();
  const courses = useCourses();
  const config = useConfig();
  const home = useQuery({ queryKey: ["home", me.data?.id ?? "guest"], queryFn: api.home });
  const posters = new Map((home.data ? [...home.data.mine, ...home.data.latest] : []).map((l) => [l.courseId, l]));

  return (
    <div className="px-4 py-4 md:px-6">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Мои курсы</h1>
        <Link to="/new" className="yt-pill yt-pill-primary">
          <Plus size={18} /> Создать
        </Link>
      </div>
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
          <div className="text-lg font-medium text-text">Пока пусто</div>
          <p className="max-w-xs text-sm">Загрузи конспект, лекцию или главу учебника — получишь курс из коротких роликов с озвучкой и вопросами.</p>
          <Link to="/new" className="yt-pill yt-pill-primary">
            Создать первый курс
          </Link>
        </Centered>
      )}
      {courses.data && courses.data.length > 0 && (
        <VideoGrid>
          {courses.data.map((c) => (
            <CourseVideoCard key={c.id} course={c} poster={posters.get(c.id)} />
          ))}
        </VideoGrid>
      )}
    </div>
  );
}
