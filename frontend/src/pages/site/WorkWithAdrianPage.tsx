import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SectionHeader from "@/components/site/SectionHeader";
import { offerLadder } from "@/content/siteData";

const engagementPrinciples = [
  "Strategy-led implementation, not commodity execution",
  "Clear decision ownership between leadership and engineering",
  "Governance and delivery cadence designed before scaling tool usage",
  "Quality and architecture guardrails embedded in delivery flow",
];

const fitSignals = [
  "You lead engineering or transformation and need a structured AI adoption model.",
  "Your organization has AI tooling activity but no coherent operating system.",
  "You need architecture, management, and delivery alignment to move faster safely.",
  "You want premium advisory depth with practical implementation guidance.",
];

const WorkWithAdrianPage = () => {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <section className="rounded-2xl border border-border bg-gradient-panel px-6 py-12 shadow-soft sm:px-10">
        <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
          Commercial Center
        </Badge>
        <h1 className="mt-4 font-heading text-3xl font-semibold sm:text-4xl">Work With Adrian</h1>
        <p className="mt-4 max-w-3xl text-base text-muted-foreground">
          Engagements are designed for organizations that need strategic AI transformation and
          execution control. The structure moves from paid diagnosis to roadmap and implementation.
        </p>
        <Button asChild className="mt-8 rounded-full px-6">
          <Link to="/contact-book">
            Book Strategic Triage
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </section>

      <section className="mt-14">
        <SectionHeader
          eyebrow="Offer Ladder"
          title="Engagement Pathways"
          description="Select the entry point that matches your current transformation stage."
        />
        <div className="mt-7 grid gap-5 lg:grid-cols-2">
          {offerLadder.map((offer) => (
            <Card key={offer.title} className="border-border/80 bg-card/90">
              <CardHeader>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                  {offer.scope}
                </p>
                <CardTitle className="font-heading text-xl">{offer.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{offer.outcome}</p>
                <Button asChild variant="link" className="mt-3 h-auto p-0 text-sm">
                  <Link to="/contact-book">{offer.cta}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-14 grid gap-6 lg:grid-cols-2">
        <Card className="border-border/80 bg-card/90">
          <CardHeader>
            <CardTitle className="font-heading text-2xl">Engagement Principles</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {engagementPrinciples.map((item) => (
                <li key={item} className="flex gap-2 text-sm text-muted-foreground">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/90">
          <CardHeader>
            <CardTitle className="font-heading text-2xl">Who This Is For</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {fitSignals.map((item) => (
                <li key={item} className="flex gap-2 text-sm text-muted-foreground">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default WorkWithAdrianPage;
