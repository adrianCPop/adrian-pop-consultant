export interface NavItem {
  label: string;
  href: string;
}

export interface Offer {
  title: string;
  scope: string;
  outcome: string;
  cta: string;
}

export interface Outcome {
  title: string;
  detail: string;
}

export interface DomainCard {
  title: string;
  summary: string;
  href: string;
}

export interface CaseStudy {
  title: string;
  challenge: string;
  intervention: string;
  outcome: string;
  href?: string;
}

export interface Insight {
  title: string;
  format: string;
  summary: string;
}

export interface TopicPageSection {
  heading: string;
  points: string[];
}

export interface TopicPageData {
  route: string;
  title: string;
  audience: string;
  summary: string;
  keyOutcome: string;
  sections: TopicPageSection[];
  ctaLabel: string;
}

export const primaryNav: NavItem[] = [
  { label: "Services", href: "/#services" },
  { label: "Work", href: "/#work" },
  { label: "Background", href: "/#background" },
  { label: "Insights", href: "/insights" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact-book" },
];

export const trustSignals = [
  "15+ years in software systems, architecture, and leadership",
  "Interim CEO during acquisition and integration",
  "Team leadership across engineering and delivery operations",
  "AI Transformation Specialist at Wirtek since February 2026",
  "Deep experience in compliance-aware software transformation",
];

export const homepageDomains: DomainCard[] = [
  {
    title: "AI Adoption Strategy",
    summary:
      "Design practical adoption plans that align leadership, architecture, and delivery execution.",
    href: "/ai-adoption-strategy",
  },
  {
    title: "AI-Assisted Delivery Systems",
    summary:
      "Redesign workflows so AI improves planning, coding, review, and release reliability.",
    href: "/ai-assisted-delivery-systems",
  },
  {
    title: "Management AI Enablement",
    summary:
      "Equip managers with governance and operational playbooks for AI-enabled teams.",
    href: "/management-ai-enablement",
  },
  {
    title: "Architecture Advisory",
    summary:
      "Make architecture decisions that support AI scale without increasing organizational fragility.",
    href: "/architecture-advisory",
  },
  {
    title: "Compliance and eInvoicing",
    summary:
      "Modernize in regulated contexts with compliance-aware AI and integration patterns.",
    href: "/compliance-einvoicing",
  },
  {
    title: "Methods and Frameworks",
    summary:
      "Use structured models to move from AI experimentation to measurable operating outcomes.",
    href: "/methods-frameworks",
  },
];

export const homepageOutcomes: Outcome[] = [
  {
    title: "Transformation Delivery Governance",
    detail:
      "Led engineering operating rhythms, risk controls, and cross-functional coordination for multi-team software delivery programs.",
  },
  {
    title: "Leadership Through Organizational Change",
    detail:
      "Served as Interim CEO during acquisition planning and integration, aligning technical and business execution.",
  },
  {
    title: "AI Transformation Focus",
    detail:
      "Since February 2026, focused on AI transformation initiatives that connect management systems and engineering execution.",
  },
  {
    title: "Compliance-Aware Systems",
    detail:
      "Analyzed and translated complex eInvoicing requirements into implementation-ready platform constraints.",
  },
];

export const offerLadder: Offer[] = [
  {
    title: "Strategic Triage Session",
    scope: "60-90 minutes",
    outcome:
      "Clarify the core transformation bottleneck and determine the right engagement path.",
    cta: "Book Strategic Triage",
  },
  {
    title: "AI Delivery Readiness Audit",
    scope: "1-2 weeks",
    outcome:
      "Assess delivery process, architecture readiness, and management operating constraints.",
    cta: "Request Readiness Audit",
  },
  {
    title: "AI Adoption Roadmap Sprint",
    scope: "2-4 weeks",
    outcome:
      "Build an execution-ready roadmap with governance model, milestones, and risk controls.",
    cta: "Start Roadmap Sprint",
  },
  {
    title: "Transformation Implementation Program",
    scope: "8-16 weeks",
    outcome:
      "Lead strategy-led implementation with decision support, execution cadence, and operational adoption.",
    cta: "Discuss Program",
  },
  {
    title: "Advisory Governance Continuity",
    scope: "Monthly",
    outcome:
      "Retain strategic decision support as your team scales AI-enabled delivery operations.",
    cta: "Request Advisory",
  },
];

export const caseStudies: CaseStudy[] = [
  {
    title: "CorporateAI Platform",
    challenge:
      "Engineering org needed coherent AI capability across multiple business functions.",
    intervention:
      "Designed and built the MasterBrain orchestrator with DatabaseAI, UniversalCommunicator, and Process_WriteHub modules.",
    outcome:
      "Company-wide AI platform enabling non-technical teams to leverage AI workflows independently.",
  },
  {
    title: "COM-B Companion",
    challenge:
      "Behaviour-change teams needed a practical system for managing projects and analyses across multiple behaviours or populations, without relying on static COM-B worksheets and fragmented expert judgment.",
    intervention:
      "Built COM-B Companion with AI behaviour discovery, a guided or expert 5-step COM-B/BCW wizard, intervention and BCT mapping, progress tracking, and private or team workspaces. Stack: React 19, Supabase, and Google Gemini API.",
    outcome:
      "Turned COM-B analysis into an operational product: teams can define target behaviours, diagnose barriers, generate strategic plans, and track adherence through daily check-ins, streaks, heatmaps, and trend views.",
    href: "https://adrianpop.tech/comb-prod",
  },
  {
    title: "Financial Intelligence POC",
    challenge:
      "Finance team lacked real-time visibility into patterns across disparate data sources.",
    intervention:
      "Created an NL-to-SQL interface with a RAG pipeline over financial data, self-hosted on client infrastructure.",
    outcome:
      "Non-technical finance analysts queried structured data in natural language within six weeks.",
  },
  {
    title: "JIST SDLC Cross-Platform Plugin",
    challenge:
      "Teams adopting coding agents needed a repeatable delivery workflow instead of ad-hoc prompting, fragmented context, and inconsistent review quality.",
    intervention:
      "Designed JIST SDLC as a cross-platform plugin with shared project memory, task orchestration, review checkpoints, delivery evals, and runtime handoff rules for Codex, Claude, and Gemini workflows.",
    outcome:
      "A structured cross-platform delivery plugin that turns feature work into a traceable pipeline: plan, build, review, eval, and documented handoff instead of isolated chat sessions.",
  },
];

export const insights: Insight[] = [
  {
    title: "From AI Pilot to Operating Practice",
    format: "Thought Piece",
    summary:
      "How engineering organisations move from scattered experiments to governed, measurable AI adoption.",
  },
  {
    title: "Responsible AI Adoption for Delivery Leaders",
    format: "Governance Note",
    summary:
      "What to formalise before AI usage spreads faster than review discipline and accountability.",
  },
  {
    title: "n8n, Agents, and the Enterprise Workflow Stack",
    format: "Architecture Brief",
    summary:
      "Practical guidance on when orchestration helps and when teams are just moving chaos around faster.",
  },
  {
    title: "The Limits of AI Hype in Real Delivery Systems",
    format: "Field Note",
    summary:
      "Why system design, operating cadence, and governance still matter more than prompts.",
  },
];

export const topicPages: TopicPageData[] = [
  {
    route: "/ai-adoption-strategy",
    title: "AI Adoption Strategy",
    audience: "CTO, VP Engineering, Transformation Leaders",
    summary:
      "Design AI adoption as an operating system change, not a tooling experiment.",
    keyOutcome:
      "Create adoption plans that improve execution performance while preserving control.",
    sections: [
      {
        heading: "What This Solves",
        points: [
          "Fragmented AI tool adoption without leadership alignment",
          "Unclear accountability between management and engineering",
          "Low confidence in AI-enabled output quality",
        ],
      },
      {
        heading: "Engagement Focus",
        points: [
          "AI adoption governance and decision rights",
          "Execution roadmap with staged capability rollout",
          "Risk controls for quality, architecture, and compliance",
        ],
      },
      {
        heading: "Typical Deliverables",
        points: [
          "90-day adoption plan",
          "Role-specific operating model",
          "Leadership KPI and review cadence",
        ],
      },
    ],
    ctaLabel: "Request AI Adoption Audit",
  },
  {
    route: "/ai-assisted-delivery-systems",
    title: "AI-Assisted Delivery Systems",
    audience: "Engineering Managers, Delivery Leads, VP Engineering",
    summary:
      "Build delivery workflows where AI improves throughput without eroding reliability.",
    keyOutcome:
      "Operationalize AI across planning, implementation, review, and release.",
    sections: [
      {
        heading: "What This Solves",
        points: [
          "Uncontrolled AI usage across delivery teams",
          "Review bottlenecks and quality variation",
          "Release delays despite higher coding output",
        ],
      },
      {
        heading: "Engagement Focus",
        points: [
          "Workflow redesign for AI-assisted execution",
          "Quality gates and review policies",
          "Management visibility and delivery metrics",
        ],
      },
      {
        heading: "Typical Deliverables",
        points: [
          "AI delivery operating playbook",
          "Role-based tool usage policies",
          "Throughput and quality measurement baseline",
        ],
      },
    ],
    ctaLabel: "Book Delivery Review",
  },
  {
    route: "/management-ai-enablement",
    title: "Management AI Enablement",
    audience: "Delivery Leaders, Engineering Managers, Program Leaders",
    summary:
      "Enable management teams to guide AI adoption with clarity, cadence, and accountability.",
    keyOutcome:
      "Turn management AI usage into a repeatable operating discipline.",
    sections: [
      {
        heading: "What This Solves",
        points: [
          "Manager uncertainty about how to govern AI adoption",
          "Inconsistent planning and reporting practices",
          "Weak linkage between AI activity and business outcomes",
        ],
      },
      {
        heading: "Engagement Focus",
        points: [
          "Management workflow redesign",
          "Decision hygiene for planning and prioritization",
          "Progress tracking and escalation protocols",
        ],
      },
      {
        heading: "Typical Deliverables",
        points: [
          "Management operating rituals",
          "Decision templates for AI-enabled teams",
          "Adoption KPI dashboard design",
        ],
      },
    ],
    ctaLabel: "Schedule Leadership Workshop",
  },
  {
    route: "/architecture-advisory",
    title: "Architecture Advisory",
    audience: "CTO, Principal Engineers, Architecture Leaders",
    summary:
      "Make architecture decisions that support AI-enabled delivery at scale.",
    keyOutcome:
      "Reduce transformation risk by aligning architecture and operating constraints.",
    sections: [
      {
        heading: "What This Solves",
        points: [
          "Legacy constraints blocking AI-enabled workflows",
          "Architecture debt amplified by faster code generation",
          "Unclear modernization sequencing",
        ],
      },
      {
        heading: "Engagement Focus",
        points: [
          "Decision-oriented architecture review",
          "Modernization path with execution checkpoints",
          "Risk-balanced sequencing for delivery continuity",
        ],
      },
      {
        heading: "Typical Deliverables",
        points: [
          "Architecture risk map",
          "Transformation-ready decision log",
          "Prioritized architecture action plan",
        ],
      },
    ],
    ctaLabel: "Request Architecture Review",
  },
  {
    route: "/compliance-einvoicing",
    title: "Compliance and eInvoicing",
    audience: "Compliance-heavy platforms, transformation leaders",
    summary:
      "Modernize complex systems under regulatory constraints without stalling delivery.",
    keyOutcome:
      "Translate compliance requirements into scalable implementation pathways.",
    sections: [
      {
        heading: "What This Solves",
        points: [
          "Regulatory complexity across regions",
          "Compliance risk introduced late in delivery",
          "Platform fragmentation due to local rule handling",
        ],
      },
      {
        heading: "Engagement Focus",
        points: [
          "Compliance-aware architecture decisions",
          "Cross-country rule interpretation for implementation",
          "Delivery governance for regulated releases",
        ],
      },
      {
        heading: "Typical Deliverables",
        points: [
          "Compliance integration roadmap",
          "Constraint-driven architecture recommendations",
          "Risk controls for release governance",
        ],
      },
    ],
    ctaLabel: "Book Compliance Diagnostic",
  },
  {
    route: "/methods-frameworks",
    title: "Methods and Frameworks",
    audience: "Executive and engineering decision-makers",
    summary:
      "Apply structured thinking models to reduce ambiguity in AI transformation decisions.",
    keyOutcome:
      "Improve decision quality and implementation confidence.",
    sections: [
      {
        heading: "Framework Library",
        points: [
          "AI Adoption Maturity Model",
          "Delivery System Friction Map",
          "Transformation Risk and Cadence Framework",
        ],
      },
      {
        heading: "How They Are Used",
        points: [
          "Diagnostic baseline and prioritization",
          "Roadmap design and governance setup",
          "Execution monitoring and adaptation",
        ],
      },
      {
        heading: "Engagement Use",
        points: [
          "Applied in triage and audit engagements",
          "Used to scope roadmap and implementation phases",
          "Supports advisory continuity and decision transparency",
        ],
      },
    ],
    ctaLabel: "Apply Framework to My Context",
  },
];

export const timelineEntries = [
  {
    period: "February 2026 - Present",
    role: "AI Transformation Specialist",
    org: "Wirtek",
    focus:
      "Focused on AI transformation initiatives that connect management operating systems and engineering delivery execution.",
  },
  {
    period: "August 2024 - January 2026",
    role: "Fiscal Compliance Business Analyst",
    org: "Wirtek",
    focus:
      "Analyzed eInvoicing compliance systems and translated regulatory requirements into implementation-ready platform guidance.",
  },
  {
    period: "November 2018 - August 2024",
    role: "Engineering Manager",
    org: "CoreBuild / Wirtek",
    focus:
      "Led multi-team delivery operations, risk management, and business-technical execution alignment.",
  },
  {
    period: "February 2022 - April 2022",
    role: "Interim CEO",
    org: "CoreBuild",
    focus:
      "Managed strategic and operational leadership during acquisition planning and integration.",
  },
  {
    period: "January 2007 - November 2018",
    role: "Embedded and iOS Leadership Track",
    org: "AROBS, SoftVision, Three Pillar Global, CoreBuild",
    focus:
      "Built technical depth across embedded systems, mobile engineering, architecture, and team leadership.",
  },
];

export const aiAdvisorPrompts = [
  "What is an agentic workflow?",
  "How does n8n compare to Zapier?",
  "EU AI Act basics",
  "Where to start with AI adoption",
];

export const footerLinks: NavItem[] = [
  { label: "Services", href: "/#services" },
  { label: "Work", href: "/#work" },
  { label: "Background", href: "/#background" },
  { label: "Insights", href: "/insights" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact-book" },
];
