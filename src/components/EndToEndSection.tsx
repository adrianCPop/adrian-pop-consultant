import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Code, Users, Building, Cpu } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

const EndToEndSection = () => {
  const { t } = useTranslation();
  
  const journeyItems = [
    {
      icon: Code,
      from: t('endToEnd.journey.reverseEngineering.from'),
      to: t('endToEnd.journey.reverseEngineering.to'),
    },
    {
      icon: Building,
      from: t('endToEnd.journey.compliance.from'),
      to: t('endToEnd.journey.compliance.to'),
    },
    {
      icon: Users,
      from: t('endToEnd.journey.leadership.from'),
      to: t('endToEnd.journey.leadership.to'),
    },
    {
      icon: Cpu,
      from: t('endToEnd.journey.technical.from'),
      to: t('endToEnd.journey.technical.to'),
    },
  ];
  
  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
              {t('endToEnd.title')}
            </h2>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {journeyItems.map((item, index) => (
              <Card key={index} className="bg-card/50 backdrop-blur border-border shadow-card hover:shadow-lg transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center shadow-glow flex-shrink-0">
                      <item.icon className="w-6 h-6 text-primary-foreground" />
                    </div>
                    
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="text-sm text-muted-foreground truncate">
                        {item.from}
                      </span>
                      <ArrowRight className="w-4 h-4 text-primary flex-shrink-0" />
                      <span className="text-sm font-medium text-foreground truncate">
                        {item.to}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default EndToEndSection;