// Демо-пользователь и курс без обращения к LLM: проверка озвучки, ленты и рендера.
// Вход: demo@learntok.local / demo1234
import { nanoid } from "nanoid";
import type { Scene } from "../shared/schema";
import { hashPassword } from "../server/auth";
import { getDb, q } from "../server/db";
import { courseMediaDir } from "../server/pipeline";
import { pickVoice, synthesizeScenes } from "../server/tts";

getDb();
const now = Date.now();
let user = q.get<{ id: string }>("select id from users where email = ?", "demo@learntok.local");
if (!user) {
  user = { id: nanoid(10) };
  q.run("insert into users (id, email, name, password_hash, created_at) values (?, ?, ?, ?, ?)", user.id, "demo@learntok.local", "Демо", hashPassword("demo1234"), now);
}

const scenes: Scene[] = [
  { type: "hook", emoji: "🚗", text: "Как спидометр узнаёт скорость в одно мгновение?", narration: "Спидометр показывает скорость прямо сейчас, в эту секунду. Но как посчитать скорость за одно мгновение?" },
  { type: "definition", term: "Производная", definition: "Скорость изменения функции в точке: предел отношения $\\Delta y$ к $\\Delta x$", narration: "Для этого придумали производную. Это скорость, с которой меняется функция в конкретной точке." },
  { type: "formula", latex: "f'(x) = \\lim_{h \\to 0} \\frac{f(x+h) - f(x)}{h}", caption: "Берём всё меньший шаг $h$", narration: "Берём маленький шаг h, смотрим, насколько изменилась функция, и делим на шаг. А потом устремляем шаг к нулю." },
  { type: "code", language: "python", code: "def deriv(f, x, h=1e-6):\n    return (f(x + h) - f(x)) / h\n\nprint(deriv(lambda x: x**2, 3))\n# ≈ 6.000001", caption: "Численная производная $x^2$ в точке 3", narration: "В коде это одна строка. Для икс в квадрате в точке три получаем почти ровно шесть." },
  { type: "example", problem: "Путь $s(t) = t^2$. Какая скорость при $t = 3$?", solution: "$s'(t) = 2t$, значит $v(3) = 6$", narration: "Если путь равен t в квадрате, то скорость это производная, два t. В момент три секунды скорость равна шести." },
  { type: "summary", text: "Производная = мгновенная скорость изменения", narration: "Запомни: производная это мгновенная скорость изменения чего угодно." },
];
const quizzes = [
  { question: "Путь $s(t) = t^2$. Какая скорость в момент $t = 5$?", options: ["25", "10", "5", "2"], correctIndex: 1, explanation: "$s'(t) = 2t$, поэтому $v(5) = 10$. 25 — это путь, а не скорость." },
  { question: "Что будет, если в численной производной взять $h = 1$ вместо $10^{-6}$?", options: ["Ответ станет точнее", "Получится средняя скорость на отрезке, а не мгновенная", "Код упадёт с ошибкой"], correctIndex: 1, explanation: "Большой шаг даёт среднюю скорость на отрезке $[x, x+1]$ — для $x^2$ в точке 3 выйдет 7, а не 6." },
];

const courseId = "demo-derivative";
q.run("delete from courses where id = ?", courseId);
q.run(
  `insert into courses (id, owner_id, title, source_name, language, voice, visibility, status, created_at, updated_at)
   values (?, ?, 'Производная за минуту', 'demo', 'ru-RU', 'female', 'public', 'ready', ?, ?)`,
  courseId, user.id, now, now,
);
const lessonId = "l1-demo";
console.log("Озвучиваю сцены…");
const audioScenes = await synthesizeScenes(scenes, courseMediaDir(courseId), lessonId, pickVoice("ru-RU", "female"));
const duration = audioScenes.reduce((s, sc) => s + (sc.audio?.duration ?? 3) + 0.7, 0);
q.run(
  `insert into lessons (id, course_id, position, title, goal, source_excerpt, status, scenes_json, quizzes_json, duration, updated_at)
   values (?, ?, 0, 'Что такое производная', 'Понять производную как мгновенную скорость изменения',
     'Производной функции f в точке x называется предел отношения приращения функции к приращению аргумента.', 'ready', ?, ?, ?, ?)`,
  lessonId, courseId, JSON.stringify(audioScenes), JSON.stringify(quizzes), duration, now,
);
console.log(`Готово: курс ${courseId}, вход demo@learntok.local / demo1234`);
