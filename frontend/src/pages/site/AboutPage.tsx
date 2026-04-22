import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const principles = [
  "Strategy must be implementable by the teams that own execution.",
  "AI adoption should improve decision quality, not just output volume.",
  "Architecture choices are management choices in disguise.",
  "Compliance constraints should shape design early, not block delivery late.",
];

const AboutPage = () => {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <section className="grid gap-8 rounded-2xl border border-border bg-gradient-panel px-6 py-12 shadow-soft sm:px-10 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
            About Adrian
          </Badge>
          <h1 className="mt-4 font-heading text-3xl font-semibold sm:text-4xl">Senior advisor for AI transformation and delivery systems</h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            I have worked across embedded systems, mobile engineering, architecture, delivery
            leadership, and executive roles. Since February 2026, I have focused on AI
            transformation work at Wirtek, helping organizations align management decisions,
            engineering execution, and architecture constraints.
          </p>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            My approach is strategy-led and execution-grounded. I focus on systems that scale, not
            isolated tactics.
          </p>
        </div>

        <Card className="border-border/80 bg-card/90">
          <CardContent className="space-y-3 p-6 text-sm text-muted-foreground">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Current Role</p>
            <p>
              AI Transformation Specialist, Wirtek
              <br />
              February 2026 - Present
            </p>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Primary Focus</p>
            <p>AI-assisted delivery systems and management AI enablement for engineering organizations.</p>
            <Button asChild className="mt-2 rounded-full">
              <Link to="/experience-cv">View Experience + CV</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="mt-14">
        <h2 className="font-heading text-2xl font-semibold">Operating Principles</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {principles.map((principle) => (
            <Card key={principle} className="border-border/80 bg-card/90">
              <CardContent className="p-5 text-sm text-muted-foreground">{principle}</CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
};

export default AboutPage;
