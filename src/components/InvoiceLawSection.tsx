import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Play, Save, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Rule {
  id: string;
  field: string;
  operator: string;
  value: string;
  action: string;
}

interface ValidationResult {
  success: boolean;
  results: {
    ruleId: string;
    passed: boolean;
    message: string;
  }[];
  error?: string;
}

const fields = [
  "documentType",
  "totalAmount",
  "currencyCode",
  "invoiceNumber",
  "issueDate",
  "supplierName",
  "buyerName",
  "taxAmount",
  "netAmount"
];

const operators = [
  { value: "equals", label: "equals" },
  { value: "contains", label: "contains" },
  { value: "greaterThan", label: "greater than" },
  { value: "lessThan", label: "less than" },
  { value: "notEmpty", label: "is not empty" },
  { value: "matches", label: "matches regex" }
];

const actions = [
  { value: "error", label: "error" },
  { value: "warning", label: "warning" }
];

const defaultInvoice = {
  invoice: {
    id: "INV-TEST-001",
    date: "2025-07-20",
    totalAmount: -50,
    currency: "EUR",
    buyer: {
      name: "Global Distribution Ltd",
      country: "MX",
      vatNumber: ""
    },
    seller: {
      name: "Adrian Pop Consulting",
      country: "ES",
      vatNumber: "ES987654321"
    },
    lineItems: [
      {
        description: "Consulting Services",
        quantity: 5,
        unitPrice: 200
      },
      {
        description: "AI-based validation setup",
        quantity: 1,
        unitPrice: 0
      }
    ],
    paymentMethod: null
  }
};

const InvoiceLawSection = () => {
  const [rules, setRules] = useState<Rule[]>([]);
  const [jsonInput, setJsonInput] = useState(
    JSON.stringify(defaultInvoice, null, 2)
  );
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Check for authenticated user
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const addRule = () => {
    const newRule: Rule = {
      id: Date.now().toString(),
      field: "",
      operator: "",
      value: "",
      action: "error"
    };
    setRules([...rules, newRule]);
  };

  const removeRule = (id: string) => {
    setRules(rules.filter(rule => rule.id !== id));
  };

  const updateRule = (id: string, field: keyof Rule, value: string) => {
    setRules(rules.map(rule => 
      rule.id === id ? { ...rule, [field]: value } : rule
    ));
  };

  const runValidation = async () => {
    if (!jsonInput.trim()) {
      toast({
        title: "Error",
        description: "Please enter invoice JSON data",
        variant: "destructive"
      });
      return;
    }

    if (rules.length === 0) {
      toast({
        title: "Error", 
        description: "Please add at least one rule",
        variant: "destructive"
      });
      return;
    }

    const incompleteRule = rules.find(rule => 
      !rule.field || !rule.operator || (!rule.value && rule.operator !== "notEmpty")
    );

    if (incompleteRule) {
      toast({
        title: "Error",
        description: "Please complete all rule fields",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('validate-rules', {
        body: {
          rules,
          invoice: JSON.parse(jsonInput)
        }
      });

      if (error) throw error;
      
      setResult(data);
      toast({
        title: "Validation Complete",
        description: `${data.results.filter((r: any) => r.passed).length}/${data.results.length} rules passed`,
      });

    } catch (error: any) {
      console.error('Validation error:', error);
      toast({
        title: "Validation Failed",
        description: error.message || "Failed to validate rules",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const saveRules = async () => {
    if (!user) {
      toast({
        title: "Login Required",
        description: "Please log in to save your rules",
        variant: "destructive"
      });
      return;
    }

    // TODO: Implement rule saving to database
    toast({
      title: "Feature Coming Soon",
      description: "Rule saving will be available once user profiles are set up",
    });
  };

  return (
    <section id="invoice-law" className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
              Can you beat Adrian's logic?
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Build your own invoice validation rules and test them against real JSON data. 
              See if you can create logic as robust as what I've built for enterprise clients.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Left Column - Rule Builder */}
            <Card className="bg-card/50 backdrop-blur border-border">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-foreground">Build Your Rules</CardTitle>
                  <Button onClick={addRule} size="sm" className="bg-primary hover:bg-primary/90">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Rule
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {rules.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No rules yet. Click "Add Rule" to get started!</p>
                  </div>
                ) : (
                  rules.map((rule) => (
                    <div key={rule.id} className="p-4 border border-border rounded-lg space-y-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>if</span>
                        <Select value={rule.field} onValueChange={(value) => updateRule(rule.id, 'field', value)}>
                          <SelectTrigger className="w-32">
                            <SelectValue placeholder="field" />
                          </SelectTrigger>
                          <SelectContent>
                            {fields.map(field => (
                              <SelectItem key={field} value={field}>{field}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        
                        <Select value={rule.operator} onValueChange={(value) => updateRule(rule.id, 'operator', value)}>
                          <SelectTrigger className="w-36">
                            <SelectValue placeholder="operator" />
                          </SelectTrigger>
                          <SelectContent>
                            {operators.map(op => (
                              <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        
                        {rule.operator !== "notEmpty" && (
                          <input
                            type="text"
                            placeholder="value"
                            value={rule.value}
                            onChange={(e) => updateRule(rule.id, 'value', e.target.value)}
                            className="flex-1 px-3 py-2 text-sm bg-background border border-input rounded-md"
                          />
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>then</span>
                          <Select value={rule.action} onValueChange={(value) => updateRule(rule.id, 'action', value)}>
                            <SelectTrigger className="w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {actions.map(action => (
                                <SelectItem key={action.value} value={action.value}>{action.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <Button
                          onClick={() => removeRule(rule.id)}
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Right Column - JSON Input */}
            <Card className="bg-card/50 backdrop-blur border-border">
              <CardHeader>
                <CardTitle className="text-foreground">Invoice JSON Data</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder='Enter your invoice JSON here, e.g.:
{
  "documentType": "invoice",
  "totalAmount": 1000.00,
  "currencyCode": "EUR",
  "invoiceNumber": "INV-2024-001",
  "issueDate": "2024-01-15",
  "supplierName": "ACME Corp",
  "buyerName": "Example Ltd",
  "taxAmount": 200.00,
  "netAmount": 800.00
}'
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  className="min-h-[300px] font-mono text-sm bg-code-bg border-code-border"
                />
              </CardContent>
            </Card>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Button
              onClick={runValidation}
              disabled={isLoading || rules.length === 0}
              className="bg-primary hover:bg-primary/90 px-8"
            >
              {isLoading ? (
                "Validating..."
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Run Validation
                </>
              )}
            </Button>
            
            {user && (
              <Button
                onClick={saveRules}
                variant="outline"
                disabled={rules.length === 0}
              >
                <Save className="w-4 h-4 mr-2" />
                Save My Rules
              </Button>
            )}
          </div>

          {/* Results */}
          {result && (
            <Card className="bg-card/50 backdrop-blur border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {result.success ? (
                    <CheckCircle className="w-5 h-5 text-accent" />
                  ) : (
                    <XCircle className="w-5 h-5 text-destructive" />
                  )}
                  Validation Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {result.results.map((ruleResult, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        {ruleResult.passed ? (
                          <CheckCircle className="w-4 h-4 text-accent" />
                        ) : (
                          <XCircle className="w-4 h-4 text-destructive" />
                        )}
                        <code className="text-sm bg-code-bg px-2 py-1 rounded border border-code-border">
                          Rule {index + 1}
                        </code>
                      </div>
                      <Badge variant={ruleResult.passed ? "default" : "destructive"}>
                        {ruleResult.passed ? "PASSED" : "FAILED"}
                      </Badge>
                    </div>
                  ))}
                  
                  {result.error && (
                    <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                      <p className="text-destructive text-sm">{result.error}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </section>
  );
};

export default InvoiceLawSection;