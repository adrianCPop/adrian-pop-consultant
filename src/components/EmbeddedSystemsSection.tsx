import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Cpu, Zap, Settings } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

const EmbeddedSystemsSection = () => {
  const { t } = useTranslation();
  
  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <Card className="bg-card/50 backdrop-blur border-border shadow-card">
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-gradient-primary rounded-lg mx-auto mb-6 flex items-center justify-center shadow-glow">
                <Cpu className="w-8 h-8 text-primary-foreground" />
              </div>
              <CardTitle className="text-2xl lg:text-3xl text-foreground mb-4">
                {t('embeddedSystems.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-6">
              <p className="text-lg text-muted-foreground leading-relaxed">
                {t('embeddedSystems.description')}
              </p>
              
              {/* Timeline visualization */}
              <div className="mt-8 relative">
                <div className="flex items-center justify-center">
                  <div className="flex items-center gap-8 lg:gap-12">
                    <div className="flex flex-col items-center">
                      <div className="w-12 h-12 bg-muted/50 rounded-full flex items-center justify-center mb-2">
                        <Settings className="w-6 h-6 text-primary" />
                      </div>
                      <span className="text-sm text-muted-foreground text-center">Low-level<br />Firmware</span>
                    </div>
                    
                    <div className="hidden sm:block w-16 h-0.5 bg-gradient-to-r from-primary/50 to-primary"></div>
                    
                    <div className="flex flex-col items-center">
                      <div className="w-12 h-12 bg-muted/50 rounded-full flex items-center justify-center mb-2">
                        <Zap className="w-6 h-6 text-primary" />
                      </div>
                      <span className="text-sm text-muted-foreground text-center">Protocol<br />Layers</span>
                    </div>
                    
                    <div className="hidden sm:block w-16 h-0.5 bg-gradient-to-r from-primary to-primary/50"></div>
                    
                    <div className="flex flex-col items-center">
                      <div className="w-12 h-12 bg-muted/50 rounded-full flex items-center justify-center mb-2">
                        <Cpu className="w-6 h-6 text-primary" />
                      </div>
                      <span className="text-sm text-muted-foreground text-center">High-level<br />Systems</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default EmbeddedSystemsSection;