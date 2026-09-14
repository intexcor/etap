import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { Navigate, Route, BrowserRouter as Router, Routes, useLocation } from "react-router";
import { ApiError } from "./api";
import { Shell } from "./components/Shell";
import { Centered, Spinner } from "./components/ui";
import { useMe } from "./hooks";
import { AuthPage } from "./pages/Auth";
import { CoursePage } from "./pages/Course";
import { CourseFeedPage, ReviewPage } from "./pages/FeedPages";
import { ExplorePage, LibraryPage } from "./pages/Library";
import { NewCoursePage } from "./pages/NewCourse";
import { ProfilePage } from "./pages/Profile";
import "./styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
      refetchOnWindowFocus: false,
    },
  },
});

function RequireAuth({ children }: { children: ReactNode }) {
  const me = useMe();
  const location = useLocation();
  if (me.isPending) {
    return (
      <Centered>
        <Spinner />
      </Centered>
    );
  }
  if (!me.data) return <Navigate to="/login" replace state={{ from: location.pathname + location.hash }} />;
  return children;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      {/* Лента без оболочки: полноэкранная. Курсы по ссылке доступны без входа. */}
      <Route path="/c/:id/feed" element={<CourseFeedPage />} />
      <Route element={<Shell />}>
        <Route path="/c/:id" element={<CoursePage />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <LibraryPage />
            </RequireAuth>
          }
        />
        <Route
          path="/new"
          element={
            <RequireAuth>
              <NewCoursePage />
            </RequireAuth>
          }
        />
        <Route
          path="/profile"
          element={
            <RequireAuth>
              <ProfilePage />
            </RequireAuth>
          }
        />
      </Route>
      <Route
        path="/review"
        element={
          <RequireAuth>
            <ReviewPage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Router>
        <App />
      </Router>
    </QueryClientProvider>
  </StrictMode>,
);
