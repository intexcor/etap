import { Player } from "@remotion/player";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Brain, Film, MessageCircleQuestion, ShieldCheck, Sparkles, Upload } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { Link } from "react-router";
import { LessonVideo } from "../../../remotion/Lesson";
import { FPS, HEIGHT, WIDTH, lessonFrames } from "../../../remotion/timing";
import { api } from "../api";
import { useConfig } from "../hooks";

const DEMO_COURSE = "demo-derivative";

export function LandingPage() {
  const config = useConfig();
  const demo = useQuery({ queryKey: ["feed", DEMO_COURSE], queryFn: () => api.feed(DEMO_COURSE), retry: false });
  const lesson = demo.data?.lessons[0];
  const inputProps = useMemo(
    () => (lesson ? { lesson: { index: lesson.position, title: lesson.title, scenes: lesson.scenes }, mediaBase: "" } : null),
    [lesson],
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-6">
      <header className="mb-14 flex items-center justify-between">
        <div className="text-xl font-extrabold tracking-tight">
          Learn<span className="text-accent">Tok</span>
        </div>
        <nav className="flex items-center gap-2 text-sm">
          <Link to="/explore" className="rounded-xl px-3 py-2 text-muted hover:text-text">
            Обзор
          </Link>
          <Link to="/login" className="rounded-xl px-3 py-2 text-muted hover:text-text">
            Войти
          </Link>
          {config.data?.registrationOpen !== false && (
            <Link to="/register" className="rounded-xl bg-accent px-4 py-2 font-semibold text-white">
              Начать
            </Link>
          )}
        </nav>
      </header>

      <section className="grid items-center gap-10 md:grid-cols-[1.1fr_0.9fr]">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1 text-xs text-muted">
            <Sparkles size={14} className="text-accent" /> Любой материал → лента коротких уроков
          </div>
          <h1 className="text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl md:text-6xl">
            Учись так, как листаешь <span className="text-accent">ленту</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted">
            Загрузи конспект, главу учебника или PDF лекции. LearnTok разберёт материал на темы, снимет по ролику на каждую — с озвучкой,
            формулами и кодом — и проверит тебя вопросами. Что не запомнилось, вернётся в ленту через день, три дня, неделю.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/register" className="rounded-xl bg-accent px-6 py-3 text-base font-bold text-white shadow-[0_10px_40px_rgba(139,108,255,0.35)]">
              Создать первый курс
            </Link>
            <Link to={`/c/${DEMO_COURSE}/feed`} className="rounded-xl border border-line px-6 py-3 text-base font-semibold hover:bg-panel-2">
              Посмотреть демо
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted">Бесплатно. Работает в браузере и как приложение на телефоне.</p>
        </div>

        <div className="mx-auto w-full max-w-[320px]">
          <div className="relative aspect-[9/16] overflow-hidden rounded-[2rem] border-[6px] border-panel-2 bg-bg shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
            {inputProps ? (
              <Player
                component={LessonVideo}
                inputProps={inputProps}
                durationInFrames={lessonFrames(lesson!)}
                fps={FPS}
                compositionWidth={WIDTH}
                compositionHeight={HEIGHT}
                style={{ width: "100%", height: "100%" }}
                autoPlay
                loop
                initiallyMuted
                acknowledgeRemotionLicense
              />
            ) : (
              <div className="grid h-full place-items-center px-6 text-center text-sm text-muted">
                {demo.isPending ? "Загружаю демо…" : "Демо-курс появится после npm run seed:demo"}
              </div>
            )}
          </div>
          <p className="mt-3 text-center text-xs text-muted">Демо без звука. В ленте — с озвучкой и субтитрами.</p>
        </div>
      </section>

      <section className="mt-24">
        <h2 className="mb-8 text-center text-2xl font-extrabold">Три шага</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Step n={1} icon={<Upload />} title="Загрузи материал">
            PDF, текст, Markdown или код. Материал делится на страницы и индексируется — каждый урок опирается на конкретные фрагменты.
          </Step>
          <Step n={2} icon={<Film />} title="Получи ролики">
            Модель пишет сценарий: зацепка, суть, пример, вывод. Формулы через KaTeX, код с подсветкой, озвучка с субтитрами по словам.
          </Step>
          <Step n={3} icon={<Brain />} title="Закрепи">
            После ролика — вопросы. Ошибся — тема вернётся. Интервальные повторения работают сами, тебе остаётся листать.
          </Step>
        </div>
      </section>

      <section className="mt-24 grid gap-4 md:grid-cols-2">
        <Feature icon={<MessageCircleQuestion />} title="Спроси материал">
          Вопрос по курсу — ответ по тексту с номерами страниц. Без выдумок: если в материале ответа нет, так и скажет.
        </Feature>
        <Feature icon={<BookOpen />} title="Формулы и код как в учебнике">
          Девять типов сцен: определение, формула, код, шаги, сравнение, задача с решением, ключевая идея, тезисы, вывод.
        </Feature>
        <Feature icon={<Film />} title="MP4 для TikTok и Reels">
          Любой урок собирается в вертикальное видео 1080×1920 — выкладывай, куда хочешь.
        </Feature>
        <Feature icon={<ShieldCheck />} title="Твои данные — у тебя">
          Курсы приватные по умолчанию. Можно делиться ссылкой или опубликовать в «Обзор». Генерация — через Claude или локальную модель на твоём железе.
        </Feature>
      </section>

      <section className="mt-24 rounded-3xl border border-line bg-panel p-8 text-center md:p-12">
        <h2 className="text-2xl font-extrabold md:text-3xl">Первый курс — за пару минут</h2>
        <p className="mx-auto mt-3 max-w-lg text-muted">Регистрация по e-mail, без карты. Прогресс и повторения сохраняются на всех устройствах.</p>
        <Link to="/register" className="mt-6 inline-block rounded-xl bg-accent px-7 py-3 text-base font-bold text-white">
          Начать бесплатно
        </Link>
      </section>

      <footer className="mt-16 flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
        <span>© {new Date().getFullYear()} LearnTok</span>
        <span className="flex gap-4">
          <Link to="/explore">Публичные курсы</Link>
          <a href="https://github.com/intexcor/etap" target="_blank" rel="noreferrer">
            GitHub
          </a>
        </span>
      </footer>
    </div>
  );
}

const Step = ({ n, icon, title, children }: { n: number; icon: ReactNode; title: string; children: ReactNode }) => (
  <div className="rounded-2xl border border-line bg-panel p-6">
    <div className="mb-4 flex items-center gap-3">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/15 text-accent">{icon}</span>
      <span className="text-xs font-bold uppercase tracking-widest text-muted">Шаг {n}</span>
    </div>
    <div className="text-lg font-bold">{title}</div>
    <p className="mt-2 text-sm leading-relaxed text-muted">{children}</p>
  </div>
);

const Feature = ({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) => (
  <div className="flex gap-4 rounded-2xl border border-line bg-panel p-6">
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-2/15 text-accent-2">{icon}</span>
    <div>
      <div className="font-bold">{title}</div>
      <p className="mt-1 text-sm leading-relaxed text-muted">{children}</p>
    </div>
  </div>
);
