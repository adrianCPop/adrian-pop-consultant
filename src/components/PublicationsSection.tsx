import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink, BookOpen } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

const PublicationsSection = () => {
  const { t } = useTranslation();
  return (
    <section className="py-20 px-4 max-w-6xl mx-auto">
      <div className="text-center mb-16">
        <h2 className="text-4xl font-bold mb-4 bg-gradient-primary bg-clip-text text-transparent">
          {t('publications.title')}
        </h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          {t('publications.description')}
        </p>
      </div>

      <div className="max-w-4xl mx-auto">
        <Card className="group hover:shadow-elegant transition-all duration-300 border-border/50 hover:border-primary/20">
          <CardContent className="p-8">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <BookOpen className="w-6 h-6 text-primary" />
                </div>
              </div>
              
              <div className="flex-1">
                <h3 className="text-xl font-semibold mb-2 text-foreground">
                  "{t('publications.article.title')}"
                </h3>
                <p className="text-muted-foreground mb-4">
                  {t('publications.article.date')}
                </p>
                <a 
                  href="https://medium.com/@adrian.c.pop/strengths-based-development-a-long-term-strategy-for-software-teams-c5dce95bcb7a"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors font-medium"
                >
                  {t('publications.readArticle')}
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

export default PublicationsSection;