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
    <div className="min-h-screen bg-gradient-subtle flex flex-col">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header Section */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-foreground mb-4">
              {t('fiscalAlerts.title')}
            </h1>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              {t('fiscalAlerts.subtitle')}
            </p>
          </div>

          {/* Filters Section */}
          <div className="bg-background/80 backdrop-blur rounded-lg border p-6 mb-8">
            <div className="flex items-center gap-4 mb-4">
              <Filter className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold text-foreground">
                {t('fiscalAlerts.filters')}
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium text-foreground mb-2 block">Country</label>
                <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('fiscalAlerts.selectCountry')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('fiscalAlerts.allCountries')}</SelectItem>
                    {countries.map(country => (
                      <SelectItem key={country} value={country}>
                        {getCountryFlag(country)} {country}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex-1">
                <label className="text-sm font-medium text-foreground mb-2 block">Source</label>
                <Select value={selectedSource} onValueChange={setSelectedSource}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Sources" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    {sources.map(source => (
                      <SelectItem key={source} value={source}>
                        {source}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex-1">
                <label className="text-sm font-medium text-foreground mb-2 block">Sort by</label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date-desc">Date (Newest First)</SelectItem>
                    <SelectItem value="date-asc">Date (Oldest First)</SelectItem>
                    <SelectItem value="source-asc">Source (A-Z)</SelectItem>
                    <SelectItem value="source-desc">Source (Z-A)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Results Count */}
          <div className="mb-6">
            <p className="text-muted-foreground">
              {t('fiscalAlerts.showing')} {filteredAlerts.length} {t('fiscalAlerts.alerts')}
            </p>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-6 bg-muted rounded w-3/4"></div>
                    <div className="h-4 bg-muted rounded w-1/2"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="h-4 bg-muted rounded"></div>
                      <div className="h-4 bg-muted rounded"></div>
                      <div className="h-16 bg-muted rounded"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Alerts Grid */}
          {!loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAlerts.map((alert) => (
                <Card key={alert.id} className="hover:shadow-lg transition-shadow duration-200">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg leading-tight">
                        <a 
                          href={alert.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="hover:text-primary transition-colors duration-200 flex items-start gap-2"
                        >
                          {alert.title}
                          <ExternalLink className="w-4 h-4 mt-1 flex-shrink-0" />
                        </a>
                      </CardTitle>
                      {alert.fiscal_alerts_analysis && alert.fiscal_alerts_analysis.length > 0 && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          {alert.fiscal_alerts_analysis.length} impact{alert.fiscal_alerts_analysis.length !== 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{getCountryFlag(alert.country)} {alert.country}</span>
                      <span>•</span>
                      <span>{alert.source}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>{format(new Date(alert.published_date), 'MMM dd, yyyy')}</span>
                    </div>
                  </CardHeader>
                  
                   <CardContent className="space-y-4">
                     {/* Research Button */}
                     <div className="flex justify-end">
                       <Button
                         variant={alert.research_done ? "default" : "outline"}
                         size="icon"
                         onClick={() => handleResearchClick(alert)}
                         disabled={processingIds.has(alert.id)}
                         className={`h-8 w-8 ${
                           alert.research_done 
                             ? "bg-green-500 hover:bg-green-600 border-green-500 text-white" 
                             : ""
                         }`}
                       >
                         <Brain className={`w-4 h-4 ${processingIds.has(alert.id) ? 'animate-spin' : ''}`} />
                       </Button>
                     </div>

                     {/* AI Summary */}
                     <div>
                       <h4 className="font-semibold text-foreground mb-2">
                         {t('fiscalAlerts.summary')}
                       </h4>
                       <ul className="text-sm text-muted-foreground space-y-1">
                         {formatSummaryPoints(alert.ai_summary)}
                       </ul>
                     </div>
                     
                     {/* Impact Analysis */}
                    <Collapsible>
                      <CollapsibleTrigger className="flex items-center justify-between w-full p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-muted-foreground" />
                          <h4 className="font-semibold text-foreground">
                            {t('fiscalAlerts.impact')}
                          </h4>
                        </div>
                        <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2 p-4 border border-border rounded-lg bg-background/50">
                        {alert.fiscal_alerts_analysis && alert.fiscal_alerts_analysis.length > 0 ? (
                          <ul className="space-y-3">
                            {alert.fiscal_alerts_analysis.map((analysis, index) => (
                              <li key={index} className="flex items-start space-x-2">
                                <span className="text-primary mt-1">•</span>
                                <div className="space-y-1">
                                  <h5 className="font-bold text-foreground text-sm">
                                    {analysis.topic}
                                  </h5>
                                  <p className="text-sm text-muted-foreground">
                                    {analysis.details}
                                  </p>
                                </div>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            {alert.ai_impact_analysis}
                          </p>
                        )}
                      </CollapsibleContent>
                    </Collapsible>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* No Results */}
          {!loading && filteredAlerts.length === 0 && (
            <div className="text-center py-12">
              <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {t('fiscalAlerts.noResults')}
              </h3>
              <p className="text-muted-foreground">
                {t('fiscalAlerts.noResultsDescription')}
              </p>
            </div>
          )}
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
