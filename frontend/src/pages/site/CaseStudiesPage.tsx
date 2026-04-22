import { Link } from "react-router-dom";
import { ArrowRight, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SectionHeader from "@/components/site/SectionHeader";
import { caseStudies } from "@/content/siteData";

const CaseStudiesPage = () => {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <section className="rounded-2xl border border-border bg-gradient-panel px-6 py-12 shadow-soft sm:px-10">
        <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
          Case Studies
        </Badge>
        <h1 className="mt-4 font-heading text-3xl font-semibold sm:text-4xl">What I&apos;ve Built</h1>
        <p className="mt-4 max-w-3xl text-base text-muted-foreground">
          Selected transformation narratives showing the problem, the system design response, and
          the operational outcome.
        </p>
      </section>

      <section className="mt-14">
        <SectionHeader
          eyebrow="Selected Work"
          title="Execution narratives without the client-name theater"
          description="Structured for leaders evaluating strategic fit, automation depth, and real delivery credibility."
        />

        <div className="mt-7 space-y-5">
          {caseStudies.map((caseStudy) => (
            <Card key={caseStudy.title} className="border-border/80 bg-card/90">
              <CardHeader>
                <CardTitle className="font-heading text-2xl">{caseStudy.title}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-5 md:grid-cols-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-primary">Challenge</p>
                  <p className="mt-2 text-sm text-muted-foreground">{caseStudy.challenge}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-primary">Intervention</p>
                  <p className="mt-2 text-sm text-muted-foreground">{caseStudy.intervention}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-primary">Outcome</p>
                  <p className="mt-2 text-sm text-muted-foreground">{caseStudy.outcome}</p>
                  {caseStudy.href ? (
                    <a
                      href={caseStudy.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-flex items-center text-sm font-medium text-primary transition-colors hover:text-primary/85"
                    >
                      Open live product
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </a>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-14 rounded-2xl border border-border bg-card px-6 py-10 sm:px-10">
        <h2 className="font-heading text-2xl font-semibold">Need a similar transformation?</h2>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Start with a working session and identify the highest-leverage automation or adoption
          bottleneck in your current operating model.
        </p>
        <Button asChild className="mt-6 rounded-full px-6">
          <Link to="/contact-book">
            Book a Working Session
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </section>
    </div>
  );
};

export default CaseStudiesPage;
