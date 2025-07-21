import { useState, useEffect } from "react";
import type { User } from "@supabase/supabase-js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import JsonEditor from "@/components/JsonEditor";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Trash2, Play, Save, CheckCircle, XCircle, AlertTriangle, ChevronDown, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { logRuleRun } from "@/integrations/supabase/ruleRuns";
import { VALIDATE_RULES_FN } from "@/integrations/supabase/constants";
import { cn } from "@/lib/utils";

interface Rule {
  id: string;
  field: string;
  operator: string;
  value: string;
  action: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  ruleLog: {
    rule: number;
    passed: boolean;
  }[];
  // Legacy support
  success?: boolean;
  results?: {
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
  const [user, setUser] = useState<User | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);
  const { toast } = useToast();

  // Helper function to get validation status
  const getValidationStatus = () => {
    if (!result) return null;
    
    const hasErrors = result.errors?.length > 0 || result.isValid === false;
    const hasWarnings = result.warnings?.length > 0;
    
    if (hasErrors) return { type: 'error', label: '❌ Errors', color: 'destructive' } as const;
    if (hasWarnings) return { type: 'warning', label: '⚠ Warnings', color: 'secondary' } as const;
    return { type: 'success', label: '✓ Valid', color: 'default' } as const;
  };

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
      const { data, error } = await supabase.functions.invoke(VALIDATE_RULES_FN, {
        body: {
          rules,
          invoice: JSON.parse(jsonInput)
        }
      });

      if (error) throw error;
      
      setResult(data);
      
      // Enhanced toast messaging based on new response format
      const status = data.isValid ? 
        (data.warnings?.length > 0 ? "Validation completed with warnings" : "Validation passed") :
        "Validation failed";
      
      toast({
        title: status,
        description: data.isValid ? 
          `Invoice is valid${data.warnings?.length > 0 ? ` (${data.warnings.length} warnings)` : ''}` :
          `${data.errors?.length || 0} errors found`,
        variant: data.isValid ? "default" : "destructive"
      });

      // Store the validation run in Supabase
      await logRuleRun({
        invoice: JSON.parse(jsonInput),
        rules,
        result: data,
        ...(user ? { user_id: user.id } : {})
      });

    } catch (error: unknown) {
      console.error("Validation error:", error);
      setResult({
        isValid: false,
        errors: [error instanceof Error ? error.message : "Failed to validate rules"],
        warnings: [],
        ruleLog: []
      });
      toast({
        title: "Validation Failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to validate rules",
        variant: "destructive",
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
                <JsonEditor
                  placeholder={`Enter your invoice JSON here, e.g.:\n{\n  "documentType": "invoice",\n  "totalAmount": 1000.00,\n  "currencyCode": "EUR",\n  "invoiceNumber": "INV-2024-001",\n  "issueDate": "2024-01-15",\n  "supplierName": "ACME Corp",\n  "buyerName": "Example Ltd",\n  "taxAmount": 200.00,\n  "netAmount": 800.00\n}`}
                  value={jsonInput}
                  onChange={setJsonInput}
                  className="min-h-[300px]"
                />
              </CardContent>
            </Card>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <div className="flex items-center gap-4">
              <Button
                onClick={runValidation}
                disabled={isLoading || rules.length === 0}
                className="bg-primary hover:bg-primary/90 px-8"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Validating...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Run Validation
                  </>
                )}
              </Button>
              
              {/* Status Badge */}
              {result && (() => {
                const status = getValidationStatus();
                return status ? (
                  <Badge 
                    variant={status.color}
                    className="animate-fade-in transition-all duration-300"
                  >
                    {status.label}
                  </Badge>
                ) : null;
              })()}
            </div>
            
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

          {/* Loading Skeleton */}
          {isLoading && (
            <Card className="bg-card/50 backdrop-blur border-border animate-fade-in">
              <CardContent className="p-6">
                <div className="flex items-center justify-center space-x-2">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span className="text-muted-foreground">Running validation...</span>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="h-4 bg-muted animate-pulse rounded" />
                  <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
                  <div className="h-4 bg-muted animate-pulse rounded w-1/2" />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Results */}
          {result && !isLoading && (
            <div className="space-y-4 animate-fade-in">
              {/* Error Modal-like Display */}
              {(result.errors?.length > 0 || result.isValid === false) && (
                <Alert className="border-destructive bg-destructive/10 animate-scale-in">
                  <XCircle className="h-4 w-4 text-destructive" />
                  <AlertDescription className="text-destructive">
                    <div className="font-medium mb-2">Validation Failed</div>
                    <ul className="space-y-1 text-sm">
                      {result.errors?.map((error, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="w-1 h-1 bg-destructive rounded-full mt-2 flex-shrink-0" />
                          {error}
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Warning Banner */}
              {result.isValid && result.warnings?.length > 0 && (
                <Alert className="border-yellow-500 bg-yellow-500/10 animate-scale-in">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                    <div className="font-medium mb-2">Validation Passed with Warnings</div>
                    <ul className="space-y-1 text-sm">
                      {result.warnings.map((warning, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="w-1 h-1 bg-yellow-600 rounded-full mt-2 flex-shrink-0" />
                          {warning}
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Success Message */}
              {result.isValid && (!result.warnings || result.warnings.length === 0) && (
                <Alert className="border-green-500 bg-green-500/10 animate-scale-in">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800 dark:text-green-200">
                    <div className="font-medium">Validation Passed</div>
                    <p className="text-sm mt-1">All rules passed successfully!</p>
                  </AlertDescription>
                </Alert>
              )}

              {/* Rule Log Debug Section */}
              {result.ruleLog && result.ruleLog.length > 0 && (
                <Collapsible open={debugOpen} onOpenChange={setDebugOpen}>
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-between hover:bg-muted/50"
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-xs font-mono">DEBUG</span>
                        Rule Execution Log
                      </span>
                      <ChevronDown className={cn(
                        "h-4 w-4 transition-transform duration-200",
                        debugOpen && "rotate-180"
                      )} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 mt-4">
                    <Card className="bg-code-bg border-code-border">
                      <CardContent className="p-4">
                        <pre className="text-xs overflow-x-auto">
                          {JSON.stringify(result.ruleLog, null, 2)}
                        </pre>
                      </CardContent>
                    </Card>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Legacy Results Support */}
              {result.results && (
                <Card className="bg-card/50 backdrop-blur border-border">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {result.success ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <XCircle className="w-5 h-5 text-destructive" />
                      )}
                      Legacy Validation Results
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {result.results.map((ruleResult, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-3">
                            {ruleResult.passed ? (
                              <CheckCircle className="w-4 h-4 text-green-600" />
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
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default InvoiceLawSection;