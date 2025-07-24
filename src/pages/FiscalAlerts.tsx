import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Calendar, Filter, ExternalLink, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/hooks/useTranslation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

interface FiscalAlert {
  id: string;
  title: string;
  url: string;
  country: string;
  source: string;
  published_date: string;
  ai_summary: string;
  ai_impact_analysis: string;
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
  const [loading, setLoading] = useState(true);
  const [countries, setCountries] = useState<string[]>([]);

  useEffect(() => {
    fetchAlerts();
  }, []);

  useEffect(() => {
    filterAlerts();
  }, [alerts, selectedCountry]);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const response = await fetch('https://wvcnymlvoouryxuriqtl.supabase.co/functions/v1/get-fiscal-alerts', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2Y255bWx2b291cnl4dXJpcXRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2ODU0ODQsImV4cCI6MjA2ODI2MTQ4NH0.GEqlRCi9Ejj4ew5OEwCu9yAY1I-mw_OL1HBe2CtCH4A',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch fiscal alerts');
      }

      const alertsData: FiscalAlert[] = await response.json();
      setAlerts(alertsData);
      
      // Extract unique countries for filter
      const uniqueCountries = [...new Set(alertsData.map(alert => alert.country))];
      setCountries(uniqueCountries);
    } catch (error) {
      console.error('Error fetching fiscal alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterAlerts = () => {
    let filtered = alerts;
    
    if (selectedCountry !== "all") {
      filtered = filtered.filter(alert => alert.country === selectedCountry);
    }
    
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
            
            <div className="flex gap-4">
              <div className="flex-1">
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
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-4 rounded-r">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-600" />
                        <h4 className="font-semibold text-foreground">
                          {t('fiscalAlerts.impact')}
                        </h4>
                      </div>
                      {alert.fiscal_alerts_analysis && alert.fiscal_alerts_analysis.length > 0 ? (
                        <ul className="space-y-3">
                          {alert.fiscal_alerts_analysis.map((analysis, index) => (
                            <li key={index} className="flex items-start space-x-2">
                              <span className="text-yellow-600 mt-1">•</span>
                              <div className="space-y-1">
                                <h5 className="font-bold text-foreground text-sm">
                                  {analysis.topic}
                                </h5>
                                <p className="text-sm text-foreground/80">
                                  {analysis.details}
                                </p>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-foreground/80">
                          {alert.ai_impact_analysis}
                        </p>
                      )}
                    </div>
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
    </div>
  );
};

export default FiscalAlerts;