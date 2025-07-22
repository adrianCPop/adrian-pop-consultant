import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Smartphone, Code, Wrench } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

const ReverseEngineeringSection = () => {
  const { t } = useTranslation();
  
  return (
    <section className="py-20 bg-secondary/20">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <Card className="bg-card/50 backdrop-blur border-border shadow-card">
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-gradient-primary rounded-lg mx-auto mb-6 flex items-center justify-center shadow-glow">
                <Smartphone className="w-8 h-8 text-primary-foreground" />
              </div>
              <CardTitle className="text-2xl lg:text-3xl text-foreground mb-4">
                {t('reverseEngineering.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-6">
              <p className="text-lg text-muted-foreground leading-relaxed">
                {t('reverseEngineering.description')}
              </p>
              
              <div className="flex flex-wrap justify-center gap-4 mt-8">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-full">
                  <Code className="w-4 h-4 text-primary" />
                  <span className="text-sm font-mono text-foreground">iOS 4.0 SDK</span>
                </div>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-full">
                  <Wrench className="w-4 h-4 text-primary" />
                  <span className="text-sm font-mono text-foreground">Objective-C</span>
                </div>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-full">
                  <Code className="w-4 h-4 text-primary" />
                  <span className="text-sm font-mono text-foreground">Jailbreak</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default ReverseEngineeringSection;