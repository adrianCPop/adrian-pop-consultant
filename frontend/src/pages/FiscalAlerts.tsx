import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Calendar, Filter, ExternalLink, AlertTriangle, ChevronDown, Brain, FileText, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useTranslation } from "@/hooks/useTranslation";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/integrations/supabase/constants";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ResearchModal from "@/components/ResearchModal";

interface FiscalAlert {
  id: string;
  title: string;
  url: string;
  country: string;
  source: string;
  published_date: string;
  ai_summary: string;
  ai_impact_analysis: string;
  ai_structured?: object;
  research_done?: boolean;
  fiscal_alerts_analysis: {
    topic: string;
    details: string;
  }[];
}

const getCountryFlag = (country: string): string => {
  const flags: { [key: string]: string } = {
    'Belgium': '🇧🇪',
    'Mexico': '🇲🇽',
    'South Korea': '🇰🇷',
    'Germany': '🇩🇪',
    'France': '🇫🇷',
    'Spain': '🇪🇸',
    'Italy': '🇮🇹',
    'Netherlands': '🇳🇱',
    'United Kingdom': '🇬🇧',
    'United States': '🇺🇸',
    'Canada': '🇨🇦',
    'Brazil': '🇧🇷',
    'Argentina': '🇦🇷',
    'Chile': '🇨🇱',
    'Colombia': '🇨🇴',
  };
  return flags[country] || '🌍';
};

const FiscalAlerts = () => {
  const { t } = useTranslation();
  const [alerts, setAlerts] = useState<FiscalAlert[]>([]);
  const [filteredAlerts, setFilteredAlerts] = useState<FiscalAlert[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string>("all");
  const [selectedSource, setSelectedSource] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("date-desc");
  const [loading, setLoading] = useState(true);
  const [countries, setCountries] = useState<string[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState("");

  useEffect(() => {
    fetchAlerts();
  }, []);

  useEffect(() => {
    filterAndSortAlerts();
  }, [alerts, selectedCountry, selectedSource, sortBy]);

  useEffect(() => {
    // Subscribe to advanced_research table changes
    console.log('Setting up realtime subscription...');
    const channel = supabase
      .channel('advanced_research_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'advanced_research'
        },
        (payload) => {
          console.log('Received realtime update:', payload);
          // Update the alert's research_done status
          setAlerts(prev => prev.map(alert => 
            alert.id === payload.new.fiscal_alert_id 
              ? { ...alert, research_done: true }
              : alert
          ));
          // Remove from processing set
          setProcessingIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(payload.new.fiscal_alert_id);
            console.log('Removing from processing:', payload.new.fiscal_alert_id);
            return newSet;
          });
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
      });

    return () => {
      console.log('Cleaning up subscription...');
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${SUPABASE_URL}/functions/v1/get-fiscal-alerts`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch fiscal alerts');
      }

      const alertsData: FiscalAlert[] = await response.json();
      setAlerts(alertsData);
      
      // Extract unique countries and sources for filters
      const uniqueCountries = [...new Set(alertsData.map(alert => alert.country))];
      const uniqueSources = [...new Set(alertsData.map(alert => alert.source))];
      setCountries(uniqueCountries);
      setSources(uniqueSources);
    } catch (error) {
      console.error('Error fetching fiscal alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortAlerts = () => {
    let filtered = alerts;
    
    // Apply country filter
    if (selectedCountry !== "all") {
      filtered = filtered.filter(alert => alert.country === selectedCountry);
    }
    
    // Apply source filter
    if (selectedSource !== "all") {
      filtered = filtered.filter(alert => alert.source === selectedSource);
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "date-desc":
          return new Date(b.published_date).getTime() - new Date(a.published_date).getTime();
        case "date-asc":
          return new Date(a.published_date).getTime() - new Date(b.published_date).getTime();
        case "source-asc":
          return a.source.localeCompare(b.source);
        case "source-desc":
          return b.source.localeCompare(a.source);
        default:
          return 0;
      }
    });
    
    setFilteredAlerts(filtered);
  };

  const formatSummaryPoints = (summary: string) => {
    return summary.split('\n').filter(point => point.trim()).map((point, index) => (
      <li key={index} className="flex items-start space-x-2">
        <span className="text-primary mt-1">–</span>
        <span>{point.trim()}</span>
      </li>
    ));
  };

  const handleResearchClick = async (alert: FiscalAlert) => {
    if (!alert.research_done) {
      // Trigger research
      setProcessingIds(prev => new Set(prev).add(alert.id));
      
      try {
        await fetch('https://n8n.srv923194.hstgr.cloud/webhook/ai-topic-query', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authentication': 'Summarize the fiscal implication or regulatory impact described in the article'
          },
          body: JSON.stringify({
            topic_detail: alert.ai_summary,
            fiscal_alert_id: alert.id,
            topic_context: alert.country
          })
        });
      } catch (error) {
        console.error('Error triggering research:', error);
        setProcessingIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(alert.id);
          return newSet;
        });
      }
    } else {
      // Fetch and show research
      try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/advanced_research?fiscal_alert_id=eq.${alert.id}&select=html`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'apikey': SUPABASE_ANON_KEY
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch research');
        }

        const data = await response.json();
        const research = data[0];
        
        setModalContent(research?.html || '');
        setModalOpen(true);
      } catch (error) {
        console.error('Error fetching research:', error);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex flex-col">
      <Header />
      
      <main className="flex-1 pt-20">
        <div className="container-mobile">
          <div className="max-w-7xl mx-auto">
            {/* Header Section */}
            <div className="text-center mb-12 md:mb-16">
              <div className="inline-flex items-center gap-2 bg-gradient-card px-4 py-2 rounded-full border border-border mb-6 glass-effect">
                <AlertTriangle className="w-4 h-4 text-accent" />
                <span className="text-sm font-medium text-muted-foreground">Real-time Monitoring</span>
              </div>
              <h1 className="text-mobile-title font-bold text-foreground mb-4">
                {t('fiscalAlerts.title')}
              </h1>
              <p className="text-base md:text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                {t('fiscalAlerts.subtitle')}
              </p>
            </div>

            {/* Filters Section */}
            <Card className="bg-gradient-card backdrop-blur-sm border-border shadow-card-modern mb-8">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-primary rounded-xl flex items-center justify-center shadow-glow-modern">
                    <Filter className="w-4 h-4 text-primary-foreground" />
                  </div>
                  <h2 className="text-xl font-semibold text-foreground">
                    {t('fiscalAlerts.filters')}
                  </h2>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">Country</label>
                    <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                      <SelectTrigger className="h-12 glass-effect touch-manipulation">
                        <SelectValue placeholder={t('fiscalAlerts.selectCountry')} />
                      </SelectTrigger>
                      <SelectContent className="glass-effect">
                        <SelectItem value="all">{t('fiscalAlerts.allCountries')}</SelectItem>
                        {countries.map(country => (
                          <SelectItem key={country} value={country}>
                            {getCountryFlag(country)} {country}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">Source</label>
                    <Select value={selectedSource} onValueChange={setSelectedSource}>
                      <SelectTrigger className="h-12 glass-effect touch-manipulation">
                        <SelectValue placeholder="All Sources" />
                      </SelectTrigger>
                      <SelectContent className="glass-effect">
                        <SelectItem value="all">All Sources</SelectItem>
                        {sources.map(source => (
                          <SelectItem key={source} value={source}>
                            {source}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">Sort by</label>
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="h-12 glass-effect touch-manipulation">
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent className="glass-effect">
                        <SelectItem value="date-desc">Date (Newest First)</SelectItem>
                        <SelectItem value="date-asc">Date (Oldest First)</SelectItem>
                        <SelectItem value="source-asc">Source (A-Z)</SelectItem>
                        <SelectItem value="source-desc">Source (Z-A)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Results Count & Status */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <p className="text-muted-foreground font-medium">
                  {t('fiscalAlerts.showing')} <span className="text-foreground">{filteredAlerts.length}</span> {t('fiscalAlerts.alerts')}
                </p>
              </div>
              
              {!loading && filteredAlerts.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="w-4 h-4" />
                  <span>Last updated: {format(new Date(), 'MMM dd, HH:mm')}</span>
                </div>
              )}
            </div>

            {/* Loading State */}
            {loading && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <Card key={i} className="bg-gradient-card backdrop-blur-sm border-border animate-pulse">
                    <CardHeader className="pb-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-3 flex-1">
                          <div className="h-5 bg-muted rounded w-3/4"></div>
                          <div className="h-4 bg-muted rounded w-1/2"></div>
                          <div className="h-4 bg-muted rounded w-2/3"></div>
                        </div>
                        <div className="w-8 h-8 bg-muted rounded-xl ml-4"></div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-3">
                        <div className="h-4 bg-muted rounded"></div>
                        <div className="h-4 bg-muted rounded w-4/5"></div>
                        <div className="h-20 bg-muted rounded"></div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Alerts Grid */}
            {!loading && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredAlerts.map((alert, index) => (
                  <Card 
                    key={alert.id} 
                    className="group bg-gradient-card backdrop-blur-sm border-border hover:shadow-card-hover transition-all duration-300 hover:-translate-y-2 touch-manipulation"
                    style={{
                      animationDelay: `${index * 100}ms`
                    }}
                  >
                    <CardHeader className="pb-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-lg leading-tight mb-3">
                            <a 
                              href={alert.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="hover:text-primary transition-colors duration-200 flex items-start gap-2 group/link"
                            >
                              <span className="line-clamp-3">{alert.title}</span>
                              <ExternalLink className="w-4 h-4 mt-1 flex-shrink-0 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                            </a>
                          </CardTitle>
                          
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                            <span className="font-medium">{getCountryFlag(alert.country)} {alert.country}</span>
                            <span className="w-1 h-1 bg-muted-foreground rounded-full"></span>
                            <span>{alert.source}</span>
                          </div>
                          
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="w-4 h-4" />
                            <span>{format(new Date(alert.published_date), 'MMM dd, yyyy')}</span>
                          </div>
                        </div>

                        {/* Impact Badge & Research Button */}
                        <div className="flex flex-col items-end gap-2">
                          {alert.fiscal_alerts_analysis && alert.fiscal_alerts_analysis.length > 0 && (
                            <Badge variant="secondary" className="text-xs whitespace-nowrap">
                              {alert.fiscal_alerts_analysis.length} impact{alert.fiscal_alerts_analysis.length !== 1 ? 's' : ''}
                            </Badge>
                          )}
                          
                          <Button
                            variant={alert.research_done ? "default" : "outline"}
                            size="icon"
                            onClick={() => handleResearchClick(alert)}
                            disabled={processingIds.has(alert.id)}
                            className={`h-10 w-10 shadow-button-modern transition-all duration-300 ${
                              alert.research_done 
                                ? "bg-gradient-primary hover:shadow-glow-modern" 
                                : "glass-effect hover:bg-accent/10"
                            }`}
                          >
                            {processingIds.has(alert.id) ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Brain className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="space-y-4 pt-0">
                      {/* AI Summary */}
                      <div className="bg-background/30 rounded-xl p-4 border border-border">
                        <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                          <div className="w-2 h-2 bg-primary rounded-full"></div>
                          {t('fiscalAlerts.summary')}
                        </h4>
                        <ul className="text-sm text-muted-foreground space-y-2">
                          {formatSummaryPoints(alert.ai_summary)}
                        </ul>
                      </div>
                      
                      {/* Impact Analysis */}
                      <Collapsible>
                        <CollapsibleTrigger className="flex items-center justify-between w-full p-4 rounded-xl bg-background/20 border border-border hover:bg-background/40 transition-all duration-200 group/trigger">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-orange-500/20 to-red-600/20 rounded-xl flex items-center justify-center">
                              <AlertTriangle className="w-4 h-4 text-orange-400" />
                            </div>
                            <h4 className="font-semibold text-foreground">
                              {t('fiscalAlerts.impact')}
                            </h4>
                          </div>
                          <ChevronDown className="w-5 h-5 text-muted-foreground transition-all duration-200 group-data-[state=open]/trigger:rotate-180" />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-3">
                          <div className="p-4 rounded-xl bg-background/20 border border-border">
                            {alert.fiscal_alerts_analysis && alert.fiscal_alerts_analysis.length > 0 ? (
                              <ul className="space-y-4">
                                {alert.fiscal_alerts_analysis.map((analysis, index) => (
                                  <li key={index} className="flex items-start gap-3">
                                    <div className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                      <span className="w-2 h-2 bg-primary rounded-full"></span>
                                    </div>
                                    <div className="space-y-1 min-w-0">
                                      <h5 className="font-bold text-foreground text-sm">
                                        {analysis.topic}
                                      </h5>
                                      <p className="text-sm text-muted-foreground leading-relaxed">
                                        {analysis.details}
                                      </p>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-sm text-muted-foreground leading-relaxed">
                                {alert.ai_impact_analysis}
                              </p>
                            )}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* No Results */}
            {!loading && filteredAlerts.length === 0 && (
              <div className="text-center py-16">
                <div className="w-24 h-24 bg-gradient-card rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-card-modern">
                  <AlertTriangle className="w-12 h-12 text-muted-foreground" />
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-4">
                  {t('fiscalAlerts.noResults')}
                </h3>
                <p className="text-muted-foreground text-lg max-w-md mx-auto leading-relaxed mb-8">
                  {t('fiscalAlerts.noResultsDescription')}
                </p>
                <Button
                  onClick={() => {
                    setSelectedCountry("all");
                    setSelectedSource("all");
                  }}
                  className="bg-gradient-primary hover:shadow-glow-modern transition-all duration-300 px-6 touch-manipulation"
                >
                  Reset Filters
                </Button>
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
      
      <ResearchModal 
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        htmlContent={modalContent}
      />
    </div>
  );
};

export default FiscalAlerts;
