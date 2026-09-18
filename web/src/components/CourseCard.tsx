import { Globe, Link2, Lock } from "lucide-react";
import type { CourseSummary } from "../../../shared/api";

export const STATUS_LABEL: Record<CourseSummary["status"], string> = {
  queued: "В очереди",
  indexing: "Индексирую материал…",
  outlining: "Разбираю материал на темы…",
  generating: "Генерирую уроки…",
  ready: "Готово",
  error: "Ошибка",
};

export const VISIBILITY = {
  private: { label: "Только я", icon: Lock },
  link: { label: "По ссылке", icon: Link2 },
  public: { label: "Публичный", icon: Globe },
} as const;

export function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}
