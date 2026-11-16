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

  // The voyage pages stand on their own: the consulting site's navigation is left off
  // them. Only those three pages (the router matches them in any letter case), so a
  // mistyped address under /voyage/ still gets the site's "not found" page whole.
  const onVoyage = ["/voyage", "/voyage/log", "/voyage/admin"].includes(
    location.pathname.toLowerCase().replace(/\/+$/, "")
  );

  return (
    <div className="site-shell min-h-screen bg-background text-foreground">
      {onVoyage ? null : <SiteHeader />}
      <main className="relative z-10">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
};

export default SiteLayout;
