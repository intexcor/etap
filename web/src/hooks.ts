import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CourseDetail, CourseSummary } from "../../shared/api";
import { api } from "./api";

const isBusy = (c: Pick<CourseSummary, "status">) => c.status === "queued" || c.status === "indexing" || c.status === "outlining" || c.status === "generating";

export const useConfig = () => useQuery({ queryKey: ["config"], queryFn: api.config, staleTime: Infinity });

export const useMe = () => useQuery({ queryKey: ["me"], queryFn: api.me, staleTime: 5 * 60 * 1000 });

export const useCourses = () =>
  useQuery({
    queryKey: ["courses"],
    queryFn: api.courses,
    refetchInterval: (query) => (query.state.data?.some(isBusy) ? 3000 : false),
  });

export const useExplore = () => useQuery({ queryKey: ["explore"], queryFn: api.explore });

export const useCourse = (id: string) =>
  useQuery({
    queryKey: ["course", id],
    queryFn: () => api.course(id),
    refetchInterval: (query) => {
      const c = query.state.data as CourseDetail | undefined;
      const rendering = c?.lessons.some((l) => l.mp4?.status === "queued" || l.mp4?.status === "rendering");
      return c && (isBusy(c) || rendering) ? 2500 : false;
    },
  });

export const useFeed = (id: string) =>
  useQuery({
    queryKey: ["feed", id],
    queryFn: () => api.feed(id),
    refetchInterval: (query) => (query.state.data && isBusy(query.state.data.course) ? 4000 : false),
  });

export const useReview = () => useQuery({ queryKey: ["review"], queryFn: api.review });
export const useStats = () => useQuery({ queryKey: ["stats"], queryFn: api.stats });

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.logout,
    onSuccess: () => {
      qc.clear();
      qc.setQueryData(["me"], null);
    },
  });
}

export function useInvalidateProgress() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["courses"] });
    void qc.invalidateQueries({ queryKey: ["course"] });
    void qc.invalidateQueries({ queryKey: ["stats"] });
    void qc.invalidateQueries({ queryKey: ["review"] });
  };
}
