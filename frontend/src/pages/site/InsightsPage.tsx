import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SectionHeader from "@/components/site/SectionHeader";
import { insights } from "@/content/siteData";

const InsightsPage = () => {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <section className="rounded-2xl border border-border bg-gradient-panel px-6 py-12 shadow-soft sm:px-10">
        <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
          Thought Leadership
        </Badge>
        <h1 className="mt-4 font-heading text-3xl font-semibold sm:text-4xl">Thought Leadership</h1>
        <p className="mt-4 max-w-3xl text-base text-muted-foreground">
          Writing on AI governance, responsible adoption, and the limits of AI hype. Practical
          insights from real enterprise AI deployments.
        </p>
        <a
          href="https://medium.com/@adrian.c.pop"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center text-sm font-medium text-primary transition-colors hover:text-primary/85"
        >
          Follow on Medium
          <ArrowRight className="ml-2 h-4 w-4" />
        </a>
      </section>

      <section className="mt-14">
        <SectionHeader
          eyebrow="Editorial Direction"
          title="Evidence-based guidance for AI adoption decisions"
          description="Each piece is written to clarify governance choices, architectural tradeoffs, and the limits of AI theater."
        />
        <div className="mt-7 grid gap-5 md:grid-cols-2">
          {insights.map((insight) => (
            <Card key={insight.title} className="border-border/80 bg-card/90">
              <CardHeader>
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-primary">
                  {insight.format}
                </p>
                <CardTitle className="font-heading text-xl">{insight.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{insight.summary}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-14 rounded-2xl border border-border bg-card px-6 py-10 sm:px-10">
        <h2 className="font-heading text-2xl font-semibold">Interested in AI governance, automation architecture, or responsible AI adoption?</h2>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Follow the writing on Medium, use the assistant for a first-pass conversation, or book a
          working session for tailored advice.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild className="rounded-full px-6">
            <Link to="/ai-advisor">
              Start AI Advisor
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="rounded-full px-6">
            <Link to="/contact-book">Book Strategic Session</Link>
          </Button>
        </div>
      </section>
    </div>
  );
};

export default InsightsPage;
