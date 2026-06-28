import { useEffect, useState } from "react";

/**
 * Minimal dependency-free router built on the History API.
 * `useLocation()` re-renders on navigation; `navigate()` pushes a new path.
 */
export function useLocation(): string {
  const [path, setPath] = useState(
    typeof window !== "undefined" ? window.location.pathname : "/"
  );

  useEffect(() => {
    const onChange = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onChange);
    return () => window.removeEventListener("popstate", onChange);
  }, []);

  return path;
}

export function navigate(to: string): void {
  if (to === window.location.pathname) return;
  window.history.pushState({}, "", to);
  // pushState doesn't emit popstate, so notify useLocation listeners ourselves.
  window.dispatchEvent(new PopStateEvent("popstate"));
}
