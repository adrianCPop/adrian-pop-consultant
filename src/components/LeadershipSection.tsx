import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Users, Target } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

const LeadershipSection = () => {
  const { t } = useTranslation();
  
  return (
    <section className="py-20 bg-secondary/20">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <Card className="bg-card/50 backdrop-blur border-border shadow-card">
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-gradient-primary rounded-lg mx-auto mb-6 flex items-center justify-center shadow-glow">
                <TrendingUp className="w-8 h-8 text-primary-foreground" />
              </div>
              <CardTitle className="text-2xl lg:text-3xl text-foreground mb-4">
                {t('leadership.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-6">
              <p className="text-lg text-muted-foreground leading-relaxed">
                {t('leadership.description')}
              </p>
              
              {/* Key achievements */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                <div className="flex flex-col items-center p-4 bg-muted/30 rounded-lg">
                  <Users className="w-8 h-8 text-primary mb-2" />
                  <div className="text-2xl font-bold text-foreground">50%</div>
                  <div className="text-sm text-muted-foreground text-center">Revenue Growth</div>
                </div>
                <div className="flex flex-col items-center p-4 bg-muted/30 rounded-lg">
                  <Target className="w-8 h-8 text-primary mb-2" />
                  <div className="text-2xl font-bold text-foreground">100%</div>
                  <div className="text-sm text-muted-foreground text-center">Team Integration</div>
                </div>
                <div className="flex flex-col items-center p-4 bg-muted/30 rounded-lg">
                  <TrendingUp className="w-8 h-8 text-primary mb-2" />
                  <div className="text-2xl font-bold text-foreground">1</div>
                  <div className="text-sm text-muted-foreground text-center">Year Transition</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default LeadershipSection;