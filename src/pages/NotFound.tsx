import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="surface-glass rounded-2xl border border-white/70 px-8 py-10 text-center">
        <h1 className="mb-3 font-display text-5xl font-semibold text-foreground">404</h1>
        <p className="mb-5 text-base text-muted-foreground">This route is outside the compliance workspace.</p>
        <a href="/" className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;


