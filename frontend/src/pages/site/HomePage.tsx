import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Brain,
  ChevronRight,
  ExternalLink,
  Linkedin,
  Mail,
  ShieldCheck,
  Users,
  Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { aiAdvisorPrompts, caseStudies, insights } from "@/content/siteData";

const services = [
  {
    eyebrow: "Adoption at org scale",
    title: "AI Adoption & Transformation",
    description:
      "Company-wide AI programmes, adoption frameworks, success metrics, and change leadership for engineering organisations moving beyond pilots.",
    href: "/ai-adoption-strategy",
    cta: "Shape the adoption roadmap",
    icon: Brain,
  },
  {
    eyebrow: "Automation that survives reality",
    title: "n8n Enterprise Automation",
    description:
      "CQRS orchestration, RAG pipelines, NL-to-SQL, MCP servers, multi-agent workflows, and self-hosted n8n deployments built for production.",
    href: "/ai-assisted-delivery-systems",
    cta: "Design the workflow backbone",
    icon: Workflow,
  },
  {
    eyebrow: "Control before chaos",
    title: "AI Governance & Compliance",
    description:
      "EU AI Act classification, human-in-the-loop controls, audit trails, model cards, and vendor risk assessment for regulated environments.",
    href: "/compliance-einvoicing",
    cta: "Govern AI responsibly",
    icon: ShieldCheck,
  },
  {
    eyebrow: "Execution leadership",
    title: "Engineering Leadership",
    description:
      "Team scaling, org design, hiring frameworks, performance systems, and interim leadership across European engineering organisations.",
    href: "/about",
    cta: "Strengthen execution leadership",
    icon: Users,
  },
];

const heroStats = [
  { label: "Years in Software Delivery", value: "15+" },
  { label: "Projects Delivered", value: "50+" },
  { label: "Continents", value: "3" },
];

const heroPortrait = "/lovable-uploads/0bd02254-2987-4c7d-aa21-15304bc1a3fe.png";

const HomePage = () => {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8 sm:px-6 lg:px-8 lg:pb-24">
      <section className="section-rule pt-10">
        <div className="grid gap-10 pb-12 lg:grid-cols-[1.02fr_0.98fr] lg:items-start">
          <div className="flex flex-col justify-center">
            <p className="mb-5 text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-primary/90">
              Adrian Pop / AI transformation / enterprise automation
            </p>
            <h1 className="text-balance max-w-2xl font-heading text-4xl font-semibold leading-[1.02] text-foreground sm:text-5xl lg:text-[4rem]">
              Adrian Pop{" "}
              <span className="underline decoration-primary/80 underline-offset-[0.18em]">
                AI Transformation Consultant
              </span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">
              Driving company-wide AI and automation adoption for engineering organisations.
              15+ years in software delivery, from embedded C through iOS to enterprise AI
              orchestration. I help teams adopt AI responsibly, build n8n automation workflows,
              and navigate EU AI Act compliance. Based in Spain, working globally.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                asChild
                className="h-12 rounded-xl px-6 text-sm font-semibold shadow-[0_18px_40px_hsl(var(--primary)/0.28)]"
              >
                <Link to="/contact-book">
                  Let&apos;s Talk AI
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-12 rounded-xl border-border/80 bg-transparent px-6 text-sm text-foreground hover:bg-secondary/80"
              >
                <Link to="/case-studies">See What I&apos;ve Built</Link>
              </Button>
            </div>

            <div className="mt-8 flex flex-wrap gap-3 text-sm text-muted-foreground">
              <div className="panel-soft rounded-full px-4 py-2">AI adoption that sticks</div>
              <div className="panel-soft rounded-full px-4 py-2">n8n and agent workflows</div>
              <div className="panel-soft rounded-full px-4 py-2">EU AI Act readiness</div>
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {heroStats.map((stat) => (
                <div key={stat.label} className="panel-soft rounded-2xl px-4 py-4">
                  <p className="text-xl font-semibold text-foreground">{stat.value}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="panel-surface overflow-hidden rounded-[2rem]">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <div>
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-primary/85">
                    AI Transformation Consultant
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">Based in Spain, working globally</p>
                </div>
                <div className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-primary">
                  Available for AI consulting
                </div>
              </div>

              <div className="relative aspect-[4/4.6] min-h-[420px] bg-[radial-gradient(circle_at_18%_18%,rgba(0,208,224,0.16),transparent_28%),linear-gradient(180deg,rgba(8,10,20,0.2),rgba(8,10,20,0.55))] sm:aspect-[4/4.2]">
                <div className="blueprint-grid absolute inset-0 opacity-20" />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,8,20,0.1)_0%,rgba(4,8,20,0.08)_38%,rgba(4,8,20,0.58)_100%)]" />
                <div className="absolute inset-x-6 top-6 z-10 flex flex-wrap gap-2">
                  <div className="rounded-full border border-white/10 bg-background/55 px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-foreground backdrop-blur">
                    Systems that actually ship
                  </div>
                  <div className="rounded-full border border-white/10 bg-background/55 px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground backdrop-blur">
                    Human-in-the-loop
                  </div>
                </div>

                <div className="absolute inset-y-0 right-0 w-full">
                  <img
                    src={heroPortrait}
                    alt="Adrian Pop — AI Transformation Consultant"
                    className="h-full w-full object-cover object-[54%_20%] sm:object-[54%_18%]"
                  />
                </div>

                <div className="absolute inset-x-0 bottom-0 z-10 border-t border-white/10 bg-[linear-gradient(180deg,rgba(8,10,20,0.18),rgba(8,10,20,0.78))] px-6 py-5 backdrop-blur-sm">
                  <div className="grid gap-3 sm:grid-cols-3">
                    {heroStats.map((stat) => (
                      <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-primary/80">
                          {stat.value}
                        </p>
                        <p className="mt-2 text-sm font-medium text-foreground">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[1.05fr_0.95fr]">
              <div className="panel-soft rounded-[1.5rem] px-5 py-5">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-primary/85">
                  Advisory focus
                </p>
                <p className="mt-3 text-base leading-7 text-foreground">
                  AI adoption, n8n workflow architecture, governance, and delivery systems for engineering teams.
                </p>
              </div>

              <div className="panel-soft rounded-[1.5rem] px-5 py-5">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-primary/85">
                  Working style
                </p>
                <p className="mt-3 text-base leading-7 text-foreground">
                  Less theater, more execution. Start with the friction, remove manual glue, then scale.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="services" className="section-rule py-10">
        <div className="mb-7 max-w-3xl">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-primary/85">
            Services
          </p>
          <h2 className="mt-3 font-heading text-3xl font-semibold text-foreground sm:text-[2.2rem]">
            What I Do
          </h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground sm:text-base">
            AI adoption, enterprise automation, governance, and engineering leadership for teams
            moving from experiments to operating capability.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {services.map((service) => (
            <Link
              key={service.title}
              to={service.href}
              className="panel-surface group rounded-[1.6rem] p-5 transition-transform duration-300 hover:-translate-y-1"
            >
              <service.icon className="h-6 w-6 text-primary" />
              <p className="mt-3 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-primary/85">
                {service.eyebrow}
              </p>
              <h3 className="mt-3 font-heading text-[1.45rem] font-semibold text-foreground">
                {service.title}
              </h3>
              <p className="mt-4 text-sm leading-7 text-muted-foreground">{service.description}</p>
              <span className="mt-6 inline-flex items-center text-sm font-medium text-primary">
                {service.cta}
                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
        <div className="panel-soft mt-6 flex flex-col items-start justify-between gap-4 rounded-[1.6rem] p-5 sm:flex-row sm:items-center">
          <div>
            <p className="font-medium text-foreground">Ready to start your AI transformation?</p>
            <p className="text-sm text-muted-foreground">
              Start with the highest-friction workflow and build from there.
            </p>
          </div>
          <Button asChild className="rounded-xl px-5">
            <Link to="/contact-book">Book a Working Session</Link>
          </Button>
        </div>
      </section>

      <section id="work" className="section-rule py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-primary/85">
              Case Studies
            </p>
            <h2 className="mt-3 font-heading text-3xl font-semibold text-foreground sm:text-[2.2rem]">
              What I&apos;ve Built
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
              Real delivery work framed as problem, solution, and outcome. No client names, just
              execution detail.
            </p>
          </div>
          <Link
            to="/case-studies"
            className="inline-flex items-center text-sm font-medium text-primary transition-colors hover:text-primary/85"
          >
            See all case studies
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {caseStudies.map((caseStudy) => (
            <div key={caseStudy.title} className="panel-surface rounded-[1.6rem] p-5">
              <h3 className="font-heading text-[1.35rem] font-semibold text-foreground">
                {caseStudy.title}
              </h3>
              <div className="mt-4 space-y-3 text-sm leading-7 text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">Problem:</span> {caseStudy.challenge}
                </p>
                <p>
                  <span className="font-medium text-foreground">Solution:</span> {caseStudy.intervention}
                </p>
                <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-foreground">
                  <span className="font-medium">Outcome:</span> {caseStudy.outcome}
                </div>
              </div>
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
          ))}
        </div>
      </section>

      <section className="section-rule py-10">
        <div className="panel-surface rounded-[2rem] px-6 py-10 sm:px-10">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-primary/85">
            Interactive Demo
          </p>
          <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_0.95fr] lg:items-center">
            <div>
              <h2 className="font-heading text-3xl font-semibold text-foreground sm:text-[2.2rem]">
                AI Automation Assistant
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                Ask about AI adoption, automation architecture, or n8n workflows. The assistant is
                positioned as a live capability demo, not an eInvoicing niche tool.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild className="rounded-xl px-5">
                  <Link to="/ai-advisor">
                    Try the AI Automation Assistant
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
            <div className="grid gap-3">
              {aiAdvisorPrompts.map((prompt) => (
                <div key={prompt} className="panel-soft rounded-2xl px-4 py-3 text-sm text-muted-foreground">
                  {prompt}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section-rule py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-primary/85">
              Thought Leadership
            </p>
            <h2 className="font-heading text-3xl font-semibold text-foreground sm:text-[2.2rem]">
              Writing on AI governance, responsible adoption, and the limits of AI hype
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
              Practical insights from real enterprise AI deployments, governance work, and delivery
              systems under pressure.
            </p>
          </div>
          <a
            href="https://medium.com/@adrian.c.pop"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-sm font-medium text-primary transition-colors hover:text-primary/85"
          >
            Follow on Medium
            <ArrowRight className="ml-2 h-4 w-4" />
          </a>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {insights.map((insight) => (
            <div key={insight.title} className="panel-surface rounded-[1.6rem] p-5">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-primary/85">
                {insight.format}
              </p>
              <h3 className="mt-3 font-heading text-[1.3rem] font-semibold text-foreground">
                {insight.title}
              </h3>
              <p className="mt-4 text-sm leading-7 text-muted-foreground">{insight.summary}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="background" className="section-rule py-10">
        <div className="panel-soft rounded-[1.8rem] px-6 py-8 sm:px-8">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-primary/85">
            Engineering Foundation
          </p>
          <h2 className="mt-3 font-heading text-3xl font-semibold text-foreground sm:text-[2.2rem]">
            Deep Roots in Software Engineering
          </h2>
          <p className="mt-4 max-w-4xl text-sm leading-8 text-muted-foreground sm:text-base">
            Before AI transformation and automation architecture, 15 years of hands-on engineering
            built the technical intuition behind the consulting work today: reverse-engineering iOS
            SDK 4.0, hardware-level jailbreak on iPhone gen 1, leading and mentoring iOS teams,
            building firmware for CAN bus embedded systems, IoT smart home automation, and
            eInvoicing compliance across Mexico, EU, and LATAM (CFDI, SAF-T, Peppol BIS 3.0).
            This depth is what makes the AI work different, not just prompting, but engineering.
          </p>
        </div>
      </section>

      <section id="contact" className="section-rule py-12">
        <div className="panel-surface rounded-[2rem] px-6 py-10 text-center sm:px-10 sm:py-12">
          <h2 className="mx-auto max-w-3xl font-heading text-2xl font-semibold text-foreground sm:text-4xl">
            Let&apos;s talk about AI adoption for your organisation
          </h2>
          <p className="mx-auto mt-4 max-w-3xl text-base leading-8 text-muted-foreground">
            Whether you&apos;re evaluating AI tools, building automation workflows, or navigating EU
            AI Act compliance, I&apos;m happy to have a no-commitment conversation.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button
              asChild
              className="h-12 rounded-xl px-6 text-sm font-semibold shadow-[0_18px_40px_hsl(var(--primary)/0.28)]"
            >
              <Link to="/contact-book">Let&apos;s Talk AI</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-12 rounded-xl border-border/80 bg-transparent px-6 text-sm text-foreground hover:bg-secondary/80"
            >
              <a href="mailto:adrian.c.pop@gmail.com">
                <Mail className="h-4 w-4" />
                Email me directly
              </a>
            </Button>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-sm">
            <a
              href="mailto:adrian.c.pop@gmail.com"
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-muted-foreground transition-colors hover:text-foreground"
            >
              <Mail className="h-4 w-4" />
              adrian.c.pop@gmail.com
            </a>
            <a
              href="https://www.linkedin.com/in/adrian-c-pop/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-muted-foreground transition-colors hover:text-foreground"
            >
              <Linkedin className="h-4 w-4" />
              LinkedIn
            </a>
            <a
              href="https://medium.com/@adrian.c.pop"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-muted-foreground transition-colors hover:text-foreground"
            >
              <BookOpen className="h-4 w-4" />
              Medium
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
