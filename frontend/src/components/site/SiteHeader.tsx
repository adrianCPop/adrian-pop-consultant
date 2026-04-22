import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { primaryNav } from "@/content/siteData";
import { cn } from "@/lib/utils";

const SiteHeader = () => {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  const closeMenu = () => setOpen(false);
  const isActive = (href: string) => {
    if (href.startsWith("/#")) {
      return location.pathname === "/" && location.hash === href.slice(1);
    }

    return location.pathname === href;
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/78 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link to="/" className="inline-flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/80 bg-secondary/70 text-sm font-semibold text-foreground">
            AP
          </div>
          <div className="hidden sm:block">
            <p className="font-heading text-sm font-semibold uppercase tracking-[0.2em] text-foreground">
              Adrian Pop
            </p>
            <p className="text-[0.68rem] uppercase tracking-[0.18em] text-muted-foreground">
              AI Transformation Consultant
            </p>
          </div>
        </Link>

        <nav className="hidden items-center lg:flex">
          {primaryNav.map((item, index) => (
            <div key={item.href} className="flex items-center">
              <Link
                to={item.href}
                className={cn(
                  "px-5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                  isActive(item.href) && "text-foreground"
                )}
              >
                {item.label}
              </Link>
              {index < primaryNav.length - 1 ? (
                <span className="h-5 w-px bg-border/80" aria-hidden="true" />
              ) : null}
            </div>
          ))}
        </nav>

        <div className="hidden sm:block">
          <Button
            asChild
            size="sm"
            className="h-10 rounded-xl px-5 text-sm font-semibold shadow-[0_16px_36px_hsl(var(--primary)/0.22)]"
          >
            <Link to="/contact-book">Book a Session</Link>
          </Button>
        </div>

        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-10 w-10 rounded-xl border-border/80 bg-secondary/60 lg:hidden"
          onClick={() => setOpen((current) => !current)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {open && (
        <div className="border-t border-border/70 bg-background/92 backdrop-blur-xl lg:hidden">
          <nav className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-4 sm:px-6">
            {primaryNav.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                onClick={closeMenu}
                className={cn(
                  "rounded-xl border px-4 py-3 text-sm font-medium transition-colors",
                  isActive(item.href)
                    ? "border-primary/50 bg-primary/10 text-foreground"
                    : "border-border/70 bg-secondary/45 text-muted-foreground hover:text-foreground"
                )}
              >
                {item.label}
              </Link>
            ))}
            <Button
              asChild
              className="mt-2 h-11 rounded-xl text-sm font-semibold"
              onClick={closeMenu}
            >
              <Link to="/contact-book">Book a Session</Link>
            </Button>
          </nav>
        </div>
      )}
    </header>
  );
};

export default SiteHeader;
