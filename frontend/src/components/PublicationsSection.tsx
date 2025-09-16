import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink, BookOpen, Calendar, ArrowRight, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useState, useEffect } from "react";

interface MediumArticle {
  title: string;
  description?: string;
  url: string;
  published_date: string;
  reading_time?: string;
  tags?: string[];
}

interface ArticlesResponse {
  articles: MediumArticle[];
  total_count: number;
  last_updated: string;
  source: string;
}

const PublicationsSection = () => {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  const [articles, setArticles] = useState<MediumArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'https://medynamic.preview.emergentagent.com';

  const fetchArticles = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${BACKEND_URL}/api/articles/`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: ArticlesResponse = await response.json();
      setArticles(data.articles);
      setLastUpdated(data.last_updated);
    } catch (err) {
      console.error('Failed to fetch articles:', err);
      setError('Failed to load articles. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.2 }
    );

    const element = document.getElementById('publications');
    if (element) observer.observe(element);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    fetchArticles();
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const cleanDescription = (description: string | undefined, maxLength: number = 200) => {
    if (!description) return '';
    // Remove HTML tags
    const cleanText = description.replace(/<[^>]*>/g, '');
    return cleanText.length > maxLength 
      ? `${cleanText.substring(0, maxLength)}...` 
      : cleanText;
  };

  return (
    <section id="publications" className="py-16 md:py-24 bg-secondary/20">
      <div className="container-mobile">
        <div className="max-w-5xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-12 md:mb-16">
            <div className="inline-flex items-center gap-2 bg-gradient-card px-4 py-2 rounded-full border border-border mb-6 glass-effect">
              <BookOpen className="w-4 h-4 text-accent" />
              <span className="text-sm font-medium text-muted-foreground">Publications</span>
            </div>
            <h2 className="text-mobile-title font-bold text-foreground mb-4">
              {t('publications.title')}
            </h2>
            <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              {t('publications.description')}
            </p>
          </div>

          {/* Status Messages */}
          {loading && (
            <div className="text-center py-12">
              <div className="inline-flex items-center gap-3 bg-gradient-card px-6 py-3 rounded-full border border-border">
                <RefreshCw className="w-5 h-5 animate-spin text-accent" />
                <span className="text-muted-foreground">Loading latest articles...</span>
              </div>
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md mx-auto">
                <p className="text-red-700 mb-4">{error}</p>
                <button 
                  onClick={fetchArticles}
                  className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Retry
                </button>
              </div>
            </div>
          )}

          {!loading && !error && articles.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No articles available at the moment.</p>
            </div>
          )}

          {/* Publications Grid - Dynamic Articles */}
          {!loading && !error && articles.length > 0 && (
            <div className={`space-y-8 transition-all duration-800 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}>
              {/* Last Updated Info */}
              {lastUpdated && (
                <div className="text-center mb-8">
                  <p className="text-sm text-muted-foreground">
                    Last updated: {formatDate(lastUpdated)}
                  </p>
                </div>
              )}

              {/* Dynamic Articles */}
              {articles.map((article, index) => {
                // Define different gradient colors for visual variety
                const gradientColors = [
                  "from-purple-500/20 to-pink-600/20",
                  "from-blue-500/20 to-indigo-600/20", 
                  "from-green-500/20 to-emerald-600/20",
                  "from-orange-500/20 to-red-600/20",
                  "from-yellow-500/20 to-orange-600/20"
                ];
                
                const iconColors = [
                  "text-purple-400",
                  "text-blue-400",
                  "text-green-400", 
                  "text-orange-400",
                  "text-yellow-400"
                ];

                const gradientClass = gradientColors[index % gradientColors.length];
                const iconColor = iconColors[index % iconColors.length];

                return (
                  <Card key={index} className="group bg-gradient-card backdrop-blur-sm border-border hover:shadow-card-hover transition-all duration-300 hover:-translate-y-2">
                    <CardContent className="p-6 md:p-8">
                      <div className="flex flex-col md:flex-row items-start gap-6">
                        {/* Icon */}
                        <div className="flex-shrink-0 mx-auto md:mx-0">
                          <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${gradientClass} flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-glow-modern`}>
                            <BookOpen className={`w-8 h-8 ${iconColor}`} />
                          </div>
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 text-center md:text-left">
                          <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
                            <h3 className="text-xl md:text-2xl font-semibold text-foreground leading-tight">
                              "{article.title}"
                            </h3>
                            <div className="flex items-center justify-center md:justify-start gap-2 text-muted-foreground">
                              <Calendar className="w-4 h-4" />
                              <span className="text-sm">{formatDate(article.published_date)}</span>
                            </div>
                          </div>
                          
                          {/* Abstract/Description */}
                          {article.description && (
                            <p className="text-muted-foreground mb-6 text-sm md:text-base leading-relaxed">
                              {cleanDescription(article.description)}
                            </p>
                          )}

                          {/* Meta Info */}
                          <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-4 mb-6">
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                <span>Published on Medium</span>
                              </div>
                              {article.reading_time && (
                                <div className="flex items-center gap-2">
                                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                                  <span>{article.reading_time}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Tags */}
                          {article.tags && article.tags.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-6 justify-center md:justify-start">
                              {article.tags.slice(0, 3).map((tag, tagIndex) => (
                                <span 
                                  key={tagIndex} 
                                  className="px-3 py-1 bg-background/50 border border-border rounded-full text-xs text-muted-foreground"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                          
                          {/* CTA */}
                          <a 
                            href={article.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 bg-gradient-primary hover:shadow-glow-modern transition-all duration-300 hover:scale-105 px-6 py-3 rounded-full text-primary-foreground font-medium touch-manipulation shadow-button-modern"
                          >
                            <span>Read Article</span>
                            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                          </a>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Call to Action */}
          <div className={`text-center mt-12 transition-all duration-800 delay-300 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
              <button 
                onClick={fetchArticles}
                disabled={loading}
                className="inline-flex items-center gap-2 bg-secondary/50 hover:bg-secondary/70 border border-border px-4 py-2 rounded-lg transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh Articles</span>
              </button>
            </div>
            
            <p className="text-muted-foreground mb-4">
              Want to discuss technical writing or collaboration opportunities?
            </p>
            <button 
              onClick={() => {
                const element = document.getElementById('contact');
                element?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="inline-flex items-center gap-2 text-primary hover:text-accent transition-colors duration-300 font-medium touch-manipulation"
            >
              <span>Let's Connect</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PublicationsSection;