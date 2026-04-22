import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";

const SiteLayout = () => {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      const frame = window.requestAnimationFrame(() => {
        const target = document.getElementById(location.hash.slice(1));

        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });

      return () => window.cancelAnimationFrame(frame);
    }

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.hash, location.pathname]);

  return (
    <div className="site-shell min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="relative z-10">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
};

export default SiteLayout;
