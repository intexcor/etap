import fs from "node:fs";
import path from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { DATA_DIR } from "./config";

export type Row = Record<string, SQLInputValue>;

const MIGRATIONS: string[] = [
  `
  create table users (
    id text primary key,
    email text not null unique,
    name text not null,
    password_hash text not null,
    created_at integer not null
  );
  create table sessions (
    token text primary key,
    user_id text not null references users(id) on delete cascade,
    created_at integer not null,
    expires_at integer not null
  );
  create index sessions_user on sessions(user_id);

  create table courses (
    id text primary key,
    owner_id text not null references users(id) on delete cascade,
    title text not null,
    source_name text not null,
    source_path text,
    language text,
    outline_json text,
    lessons_requested text not null default 'auto',
    voice text not null default 'female',
    visibility text not null default 'private',   -- private | link | public
    status text not null default 'queued',        -- queued | outlining | generating | ready | error
    error text,
    created_at integer not null,
    updated_at integer not null
  );
  create index courses_owner on courses(owner_id, created_at desc);
  create index courses_public on courses(visibility, created_at desc);

  create table lessons (
    id text primary key,
    course_id text not null references courses(id) on delete cascade,
    position integer not null,
    title text not null,
    goal text not null default '',
    source_excerpt text not null default '',
    status text not null default 'pending',       -- pending | ready | error
    error text,
    scenes_json text not null default '[]',
    quizzes_json text not null default '[]',
    duration real not null default 0,
    mp4_status text,                              -- null | queued | rendering | done | error
    mp4_progress real not null default 0,
    mp4_error text,
    updated_at integer not null
  );
  create index lessons_course on lessons(course_id, position);

  create table jobs (
    id text primary key,
    type text not null,                           -- generate_course | render_lesson
    course_id text references courses(id) on delete cascade,
    lesson_id text references lessons(id) on delete cascade,
    payload_json text not null default '{}',
    status text not null default 'queued',        -- queued | running | done | error
    progress real not null default 0,
    error text,
    created_at integer not null,
    started_at integer,
    finished_at integer
  );
  create index jobs_status on jobs(status, created_at);

  create table lesson_progress (
    user_id text not null references users(id) on delete cascade,
    lesson_id text not null references lessons(id) on delete cascade,
    watched integer not null default 0,
    completed_at integer,
    updated_at integer not null,
    primary key (user_id, lesson_id)
  );

  create table quiz_answers (
    id integer primary key autoincrement,
    user_id text not null references users(id) on delete cascade,
    lesson_id text not null references lessons(id) on delete cascade,
    quiz_index integer not null,
    picked integer not null,
    correct integer not null,
    created_at integer not null
  );
  create index quiz_answers_user on quiz_answers(user_id, lesson_id, quiz_index);

  create table reviews (
    user_id text not null references users(id) on delete cascade,
    lesson_id text not null references lessons(id) on delete cascade,
    due_at integer not null,
    interval_days real not null default 0,
    ease real not null default 2.5,
    reps integer not null default 0,
    lapses integer not null default 0,
    updated_at integer not null,
    primary key (user_id, lesson_id)
  );
  create index reviews_due on reviews(user_id, due_at);
  `,
];

let db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (db) return db;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new DatabaseSync(path.join(DATA_DIR, "learntok.sqlite"));
  db.exec("pragma journal_mode = wal; pragma foreign_keys = on; pragma busy_timeout = 5000;");
  db.exec("create table if not exists migrations (id integer primary key, applied_at integer not null)");
  const applied = db.prepare("select id from migrations").all().map((r) => Number(r.id));
  MIGRATIONS.forEach((sql, i) => {
    if (applied.includes(i + 1)) return;
    db!.exec("begin");
    try {
      db!.exec(sql);
      db!.prepare("insert into migrations (id, applied_at) values (?, ?)").run(i + 1, Date.now());
      db!.exec("commit");
    } catch (e) {
      db!.exec("rollback");
      throw e;
    }
  });
  return db;
}

export function transaction<T>(fn: () => T): T {
  const d = getDb();
  d.exec("begin immediate");
  try {
    const result = fn();
    d.exec("commit");
    return result;
  } catch (e) {
    d.exec("rollback");
    throw e;
  }
}

export const q = {
  run: (sql: string, ...params: SQLInputValue[]) => getDb().prepare(sql).run(...params),
  get: <T = Row>(sql: string, ...params: SQLInputValue[]) => getDb().prepare(sql).get(...params) as T | undefined,
  all: <T = Row>(sql: string, ...params: SQLInputValue[]) => getDb().prepare(sql).all(...params) as T[],
};
