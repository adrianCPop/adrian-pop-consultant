import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Cpu, Building, Workflow } from "lucide-react";

const services = [
  {
    icon: FileText,
    title: "eInvoicing & AI Compliance",
    description: "Delivered compliant invoice flows in Mexico, the EU, and LATAM. Expert in CFDI, SAF-T, and Peppol BIS 3.0. Combined rule-based validation and AI-assisted automation to streamline complex eInvoicing pipelines."
  },
  {
    icon: Cpu,
    title: "Mobile & Embedded Systems",
    description: "Reverse-engineered iOS SDK 4.0 and performed a hardware-level jailbreak on the first iPhone. Led and mentored iOS teams. Built firmware and protocols for embedded systems (CAN bus), and integrated smart home IoT automation."
  },
  {
    icon: Building,
    title: "Architecture & Interim CEO",
    description: "15+ years of experience designing scalable platforms and leading engineering teams. Served as Interim CEO during a successful acquisition, overseeing business strategy and team integration."
  },
  {
    icon: Workflow,
    title: "Process Optimization & Delivery",
    description: "Specialized in workflow design, agile delivery, and distributed team operations. I actively experiment with AI tools to optimize business processes, leveraging extensive experience in sprint management, tooling alignment, and delivery flow improvements."
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