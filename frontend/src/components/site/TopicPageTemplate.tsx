import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import SectionHeader from "@/components/site/SectionHeader";
import type { TopicPageData } from "@/content/siteData";

interface TopicPageTemplateProps {
  data: TopicPageData;
}

const TopicPageTemplate = ({ data }: TopicPageTemplateProps) => {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <section className="rounded-2xl border border-border bg-gradient-panel px-6 py-12 shadow-soft sm:px-10">
        <Badge variant="secondary" className="mb-4 rounded-full px-3 py-1 text-xs">
          {data.audience}
        </Badge>
        <h1 className="font-heading text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
          {data.title}
        </h1>
        <p className="mt-4 max-w-3xl text-base text-muted-foreground">{data.summary}</p>
        <p className="mt-6 text-sm font-medium text-foreground">{data.keyOutcome}</p>
        <Button asChild className="mt-8 rounded-full px-6">
          <Link to="/contact-book">
            {data.ctaLabel}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </section>

      <section className="mt-14 space-y-8">
        <SectionHeader
          eyebrow="Implementation Lens"
          title="How This Engagement Is Structured"
          description="Each engagement is scoped around execution reality: decision rights, architecture constraints, and delivery operating cadence."
        />

        <div className="grid gap-6 lg:grid-cols-3">
          {data.sections.map((section) => (
            <Card key={section.heading} className="border-border/80 bg-card/90">
              <CardHeader>
                <CardTitle className="font-heading text-xl">{section.heading}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {section.points.map((point) => (
                    <li key={point} className="flex gap-2 text-sm text-muted-foreground">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
};

export default TopicPageTemplate;
