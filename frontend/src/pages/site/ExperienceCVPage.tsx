import { Download, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { timelineEntries } from "@/content/siteData";

const ExperienceCVPage = () => {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <section className="rounded-2xl border border-border bg-gradient-panel px-6 py-12 shadow-soft sm:px-10">
        <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
          Experience and CV
        </Badge>
        <h1 className="mt-4 font-heading text-3xl font-semibold sm:text-4xl">Leadership Timeline and Executive Profile</h1>
        <p className="mt-4 max-w-3xl text-base text-muted-foreground">
          Career progression from technical foundations to engineering leadership, interim executive
          responsibility, and AI transformation specialization.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild className="rounded-full px-6">
            <a href="/CV_Adrian_Pop_2025.pdf" target="_blank" rel="noopener noreferrer">
              Open CV PDF
              <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </Button>
          <Button asChild variant="outline" className="rounded-full px-6">
            <a href="/CV_Adrian_Pop_2025.pdf" download>
              Download CV
              <Download className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </div>
      </section>

      <section className="mt-14 space-y-5">
        {timelineEntries.map((entry) => (
          <Card key={`${entry.period}-${entry.role}`} className="border-border/80 bg-card/90">
            <CardHeader>
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-primary">
                {entry.period}
              </p>
              <CardTitle className="font-heading text-2xl">
                {entry.role} <span className="text-base font-normal text-muted-foreground">@ {entry.org}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{entry.focus}</p>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
};

export default ExperienceCVPage;
