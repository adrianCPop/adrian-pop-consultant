import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Brain, Blocks, Cpu, Users } from "lucide-react";

const services = [
  {
    icon: FileText,
    title: "eInvoicing & Compliance",
    description: "CFDI, SAF-T, Peppol BIS 3.0 integrations. XML validators and transformations (GUF → CFDI)."
  },
  {
    icon: Brain,
    title: "AI Consulting",
    description: "Automating compliance and code validation. Prompt engineering and AI integration into business tools."
  },
  {
    icon: Blocks,
    title: "Process Consultant",
    description: "Business process optimization, workflow automation, and operational efficiency improvements."
  },
  {
    icon: Users,
    title: "Engineering Manager",
    description: "Team leadership, technical mentoring, sprint planning, and engineering culture development."
  },
  {
    icon: Cpu,
    title: "Mobile iOS, Embedded & Home Automation",
    description: "Deep mobile expertise — from reverse-engineering iOS SDK 4.0 and jailbreaking the original iPhone to building firmware, CAN bus systems, and smart home IoT solutions."
  },
  {
    icon: Users,
    title: "Tech Leadership & Interim CEO",
    description: "Strategic leadership, business vision, executive management and organizational transformation."
  }
];

const ServicesSection = () => {
  return (
    <section id="services" className="py-20 bg-secondary/30">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
              What I Do
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Comprehensive IT consulting services spanning architecture, compliance, AI integration, and team leadership.
            </p>
          </div>

          {/* Services Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service, index) => (
              <Card 
                key={index} 
                className="bg-card/50 backdrop-blur border-border hover:shadow-card transition-all duration-300 hover:-translate-y-1"
              >
                <CardHeader className="text-center">
                  <div className="w-12 h-12 bg-gradient-primary rounded-lg mx-auto mb-4 flex items-center justify-center shadow-glow">
                    <service.icon className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <CardTitle className="text-xl text-foreground">
                    {service.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-muted-foreground leading-relaxed">
                    {service.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ServicesSection;