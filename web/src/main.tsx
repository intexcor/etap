import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { Navigate, Route, BrowserRouter as Router, Routes, useLocation } from "react-router";
import { ApiError } from "./api";
import { Shell } from "./components/Shell";
import { Centered, Spinner } from "./components/ui";
import { useMe } from "./hooks";
import { AuthPage } from "./pages/Auth";
import { CourseLearnPage, ReviewPage } from "./pages/Learn";
import { FeedPage } from "./pages/Feed";
import { HomePage, SearchPage } from "./pages/Home";
import { LibraryPage } from "./pages/Library";
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

function FeedRedirect() {
  const { pathname, hash } = useLocation();
  return <Navigate to={pathname.replace(/\/feed$/, "") + hash} replace />;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      {/* Экран обучения без оболочки — со своими панелями. Курсы по ссылке доступны без входа. */}
      <Route path="/c/:id" element={<CourseLearnPage />} />
      <Route path="/c/:id/feed" element={<FeedRedirect />} />
      <Route
        path="/feed"
        element={<FeedPage />}
      />
      <Route element={<Shell />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/explore" element={<Navigate to="/" replace />} />
        <Route
          path="/library"
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
