import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Cpu, Building, Workflow } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

const ServicesSection = () => {
  const { t } = useTranslation();
  
  const services = [
    {
      icon: FileText,
      title: t('services.einvoicing.title'),
      description: t('services.einvoicing.description')
    },
    {
      icon: Cpu,
      title: t('services.mobile.title'),
      description: t('services.mobile.description')
    },
    {
      icon: Building,
      title: t('services.architecture.title'),
      description: t('services.architecture.description')
    },
    {
      icon: Workflow,
      title: t('services.process.title'),
      description: t('services.process.description')
    }
  ];
  return (
    <section id="services" className="py-20 bg-secondary/30">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
              {t('services.title')}
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t('services.description')}
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