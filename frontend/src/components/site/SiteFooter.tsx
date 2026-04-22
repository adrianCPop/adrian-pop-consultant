import { BookOpen, Linkedin, Mail } from "lucide-react";
import { Link } from "react-router-dom";
import { footerLinks } from "@/content/siteData";

const SiteFooter = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="relative z-10 mt-16 border-t border-border/70">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="font-heading text-lg font-semibold text-foreground">Adrian Pop</p>
          <nav className="flex flex-wrap items-center justify-center gap-5 text-sm text-muted-foreground">
            {footerLinks.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className="transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a
              href="mailto:adrian.c.pop@gmail.com"
              className="inline-flex items-center gap-2 rounded-full border border-border/70 px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <Mail className="h-4 w-4" />
              Email
            </a>
            <a
              href="https://www.linkedin.com/in/adrian-c-pop/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-border/70 px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <Linkedin className="h-4 w-4" />
              LinkedIn
            </a>
            <a
              href="https://medium.com/@adrian.c.pop"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-border/70 px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <BookOpen className="h-4 w-4" />
              Medium
            </a>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            AI Transformation Consultant — helping engineering organisations adopt AI, build
            automation, and govern it responsibly.
          </p>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-border/70 pt-5 text-xs text-muted-foreground sm:flex-row">
          <p>© {year} Adrian Pop</p>
          <a
            href="mailto:adrian.c.pop@gmail.com"
            className="transition-colors hover:text-foreground"
          >
            adrian.c.pop@gmail.com
          </a>
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;
