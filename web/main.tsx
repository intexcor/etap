import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Feed } from "./Feed";
import { Home } from "./Home";
import "./styles.css";

function useHash() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const onChange = () => setHash(location.hash);
    addEventListener("hashchange", onChange);
    return () => removeEventListener("hashchange", onChange);
  }, []);
  return hash;
}

function App() {
  const course = useHash().match(/^#\/c\/([\w-]+)/);
  return course ? <Feed key={course[1]} id={course[1]} /> : <Home />;
}

createRoot(document.getElementById("root")!).render(<App />);
