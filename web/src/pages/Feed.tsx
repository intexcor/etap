// Общая вертикальная лента: все публичные уроки (и свои), новые первыми, с подгрузкой.
import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Link } from "react-router";
import { api } from "../api";
import { Centered, ErrorBox, Spinner } from "../components/ui";
import { LearnView } from "../learn/LearnView";

export function FeedPage() {
  const feed = useInfiniteQuery({
    queryKey: ["global-feed"],
    queryFn: ({ pageParam }) => api.globalFeed(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const lessons = feed.data?.pages.flatMap((p) => p.lessons) ?? [];

  // Подгружаем следующую страницу заранее, пока пользователь ещё смотрит текущие.
  useEffect(() => {
    if (feed.hasNextPage && !feed.isFetchingNextPage && lessons.length < 6) void feed.fetchNextPage();
  }, [feed, lessons.length]);

  if (feed.isPending) {
    return (
      <Centered>
        <Spinner />
      </Centered>
    );
  }
  if (feed.error) {
    return (
      <Centered>
        <ErrorBox>{feed.error.message}</ErrorBox>
      </Centered>
    );
  }
  if (lessons.length === 0) {
    return (
      <Centered>
        <div className="text-6xl">🎬</div>
        <div className="text-lg font-bold text-text">В ленте пока пусто</div>
        <p className="max-w-xs text-sm">Публичных уроков ещё нет. Загрузи материал и сделай курс публичным — он появится здесь.</p>
        <Link to="/new" className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white">
          Загрузить материал
        </Link>
      </Centered>
    );
  }

  const tail = (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      {feed.hasNextPage ? (
        <>
          <Spinner />
          <p className="text-sm text-muted">Загружаю ещё…</p>
        </>
      ) : (
        <>
          <div className="text-6xl">🏁</div>
          <h2 className="text-xl font-bold">Это всё на сегодня</h2>
          <Link to="/" className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white">
            На главную
          </Link>
        </>
      )}
    </div>
  );

  return <LearnView mode="feed" title="Лента" backTo="/" lessons={lessons} tail={tail} onNearEnd={() => feed.hasNextPage && !feed.isFetchingNextPage && feed.fetchNextPage()} />;
}
