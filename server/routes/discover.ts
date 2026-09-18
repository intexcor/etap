// Главная, общая лента и поиск — витрина платформы.
import { Router } from "express";
import { z } from "zod";
import type { GlobalFeed, HomeData } from "../../shared/api";
import { q } from "../db";
import { parseBody } from "../errors";
import { getCourseRow, listLessonRows, listLessonsForFeed, listOwnCourses, listPublicCourses, searchLessons, toCourseSummary, toFeedLesson, toLessonCard } from "../repo";

export const discoverRouter = Router();

discoverRouter.get("/home", (req, res) => {
  const userId = req.user?.id;
  let cont: HomeData["continue"] = null;
  const mine = userId ? listOwnCourses(userId).filter((c) => c.status === "ready" || c.status === "generating") : [];
  if (userId) {
    // Последний начатый, но не пройденный курс — и его первый непройденный урок.
    const row = q.get<{ course_id: string }>(
      `select l.course_id from lesson_progress p join lessons l on l.id = p.lesson_id join courses c on c.id = l.course_id
       where p.user_id = ? and c.status = 'ready' order by p.updated_at desc limit 1`,
      userId,
    );
    const course = row && getCourseRow(row.course_id);
    if (course) {
      const next = listLessonRows(course.id).find(
        (l) => l.status === "ready" && !q.get("select 1 from lesson_progress where user_id = ? and lesson_id = ? and completed_at is not null", userId, l.id),
      );
      if (next) cont = { course: toCourseSummary(course, userId), lesson: toLessonCard(next, course, userId) };
    }
  }
  const data: HomeData = {
    continue: cont,
    latest: listLessonsForFeed(undefined, 24).map(({ lesson, course }) => toLessonCard(lesson, course, userId)),
    mine: mine.slice(0, 6).flatMap((c) => listLessonRows(c.id).filter((l) => l.status === "ready").slice(0, 4).map((l) => toLessonCard(l, c, userId))),
    courses: listPublicCourses(12).map((c) => toCourseSummary(c, userId)),
  };
  res.json(data);
});

discoverRouter.get("/feed", (req, res) => {
  const { cursor, limit } = parseBody(
    z.object({ cursor: z.coerce.number().optional(), limit: z.coerce.number().int().min(1).max(30).default(10) }),
    req.query,
  );
  const userId = req.user?.id;
  const items = listLessonsForFeed(userId, limit, cursor);
  const feed: GlobalFeed = {
    lessons: items.map(({ lesson, course }) => toFeedLesson(lesson, course, userId)),
    nextCursor: items.length === limit ? String(items[items.length - 1].lesson.updated_at) : null,
  };
  res.json(feed);
});

discoverRouter.get("/search", (req, res) => {
  const { q: query } = parseBody(z.object({ q: z.string().trim().min(2).max(100) }), req.query);
  res.json(searchLessons(query, req.user?.id).map(({ lesson, course }) => toLessonCard(lesson, course, req.user?.id)));
});
