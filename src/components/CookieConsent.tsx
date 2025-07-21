import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X, Cookie, Shield, Settings } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

const CONSENT_KEY = "cookie_consent";
const CONSENT_VERSION = "1.0";

interface ConsentState {
  necessary: boolean;
  preferences: boolean;
  analytics: boolean;
  marketing: boolean;
  version: string;
  timestamp: number;
}

const DEFAULT_CONSENT: ConsentState = {
  necessary: true, // Always required
  preferences: true,
  analytics: false,
  marketing: false,
  version: CONSENT_VERSION,
  timestamp: Date.now(),
};

const CookieConsent = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [consent, setConsent] = useState<ConsentState>(DEFAULT_CONSENT);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as ConsentState;
        if (parsed.version === CONSENT_VERSION) {
          setConsent(parsed);
          return;
        }
      } catch (err) {
        console.error("Failed to parse consent data", err);
      }
    }
    setIsVisible(true);
  }, []);

  const saveConsent = (newConsent: ConsentState) => {
    const consentData = {
      ...newConsent,
      timestamp: Date.now(),
      version: CONSENT_VERSION,
    };
    localStorage.setItem(CONSENT_KEY, JSON.stringify(consentData));
    setConsent(consentData);
    setIsVisible(false);
    setShowSettings(false);
  };

  const acceptAll = () => {
    saveConsent({
      necessary: true,
      preferences: true,
      analytics: true,
      marketing: true,
      version: CONSENT_VERSION,
      timestamp: Date.now(),
    });
  };

  const acceptNecessary = () => {
    saveConsent({
      necessary: true,
      preferences: false,
      analytics: false,
      marketing: false,
      version: CONSENT_VERSION,
      timestamp: Date.now(),
    });
  };

  const updateConsent = (key: keyof ConsentState, value: boolean) => {
    if (key === 'necessary') return; // Cannot disable necessary cookies
    setConsent(prev => ({ ...prev, [key]: value }));
  };

  const saveCustomConsent = () => {
    saveConsent(consent);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 pointer-events-none">
      <Card className="max-w-lg w-full p-6 space-y-4 pointer-events-auto animate-slide-in-right shadow-elegant border-border/50 bg-card/95 backdrop-blur-md">
        <div className="flex items-start gap-3">
          <Cookie className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
          <div className="space-y-3 flex-1">
            <h3 className="font-semibold text-foreground">Cookie Preferences</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We use cookies to enhance your experience, remember your theme preferences, and analyze site usage. 
              Your data is processed in accordance with GDPR regulations.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button onClick={acceptAll} size="sm" className="flex-1">
                Accept All
              </Button>
              <Button onClick={acceptNecessary} variant="outline" size="sm" className="flex-1">
                Necessary Only
              </Button>
              <Dialog open={showSettings} onOpenChange={setShowSettings}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <Settings className="h-4 w-4" />
                    Settings
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      Privacy Settings
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-sm">Necessary</div>
                          <div className="text-xs text-muted-foreground">Required for basic functionality</div>
                        </div>
                        <Switch checked={true} disabled />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-sm">Preferences</div>
                          <div className="text-xs text-muted-foreground">Remember your theme and settings</div>
                        </div>
                        <Switch 
                          checked={consent.preferences}
                          onCheckedChange={(checked) => updateConsent('preferences', checked)}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-sm">Analytics</div>
                          <div className="text-xs text-muted-foreground">Help us improve the site</div>
                        </div>
                        <Switch 
                          checked={consent.analytics}
                          onCheckedChange={(checked) => updateConsent('analytics', checked)}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-sm">Marketing</div>
                          <div className="text-xs text-muted-foreground">Personalized content</div>
                        </div>
                        <Switch 
                          checked={consent.marketing}
                          onCheckedChange={(checked) => updateConsent('marketing', checked)}
                        />
                      </div>
                    </div>
                    
                    <div className="text-xs text-muted-foreground border-t pt-3">
                      <p>Data is stored locally and processed according to GDPR guidelines. You can change these preferences anytime.</p>
                    </div>
                    
                    <div className="flex gap-2 pt-2">
                      <Button onClick={saveCustomConsent} size="sm" className="flex-1">
                        Save Preferences
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setShowSettings(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={acceptNecessary}
            className="p-1 h-auto text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default CookieConsent;