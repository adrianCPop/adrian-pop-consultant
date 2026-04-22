import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const formats = [
  {
    title: "Executive AI Adoption Briefing",
    audience: "C-suite, CTO, transformation leadership",
    outcome: "Clarify strategic choices, governance model, and 90-day priorities.",
  },
  {
    title: "Engineering Leadership Workshop",
    audience: "VP Engineering, engineering managers, delivery leads",
    outcome: "Design practical operating patterns for AI-enabled software delivery.",
  },
  {
    title: "Compliance-Aware Transformation Session",
    audience: "Regulated product and platform teams",
    outcome: "Map compliance constraints into architecture and delivery decisions.",
  },
];

const SpeakingWorkshopsPage = () => {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <section className="rounded-2xl border border-border bg-gradient-panel px-6 py-12 shadow-soft sm:px-10">
        <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
          Speaking and Workshops
        </Badge>
        <h1 className="mt-4 font-heading text-3xl font-semibold sm:text-4xl">
          Strategic Sessions for Leadership Teams
        </h1>
        <p className="mt-4 max-w-3xl text-base text-muted-foreground">
          Workshop and briefing formats designed for organizations that need clear decision models
          for AI transformation across management and engineering systems.
        </p>
      </section>

      <section className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {formats.map((format) => (
          <Card key={format.title} className="border-border/80 bg-card/90">
            <CardHeader>
              <CardTitle className="font-heading text-xl">{format.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-primary">
                {format.audience}
              </p>
              <p className="mt-3 text-sm text-muted-foreground">{format.outcome}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="mt-14 rounded-2xl border border-border bg-card px-6 py-10 sm:px-10">
        <h2 className="font-heading text-2xl font-semibold">Invite Adrian for a strategic session</h2>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Share your audience profile, current transformation constraints, and desired session
          outcome.
        </p>
        <Button asChild className="mt-6 rounded-full px-6">
          <Link to="/contact-book">Request Workshop or Briefing</Link>
        </Button>
      </section>
    </div>
  );
};

export default SpeakingWorkshopsPage;
