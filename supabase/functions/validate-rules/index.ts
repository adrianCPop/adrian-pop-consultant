import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Rule {
  id: string;
  field: string;
  operator: string;
  value: string;
  action: string;
}

interface ValidationRequest {
  rules: Rule[];
  invoice: any;
}

interface ValidationResult {
  ruleId: string;
  passed: boolean;
  message: string;
}

function validateRule(rule: Rule, invoice: any): ValidationResult {
  const fieldValue = invoice[rule.field];
  
  let passed = false;
  let message = "";

  try {
    switch (rule.operator) {
      case "equals":
        passed = fieldValue === rule.value;
        message = passed 
          ? `${rule.field} equals "${rule.value}"` 
          : `${rule.field} ("${fieldValue}") does not equal "${rule.value}"`;
        break;
        
      case "contains":
        passed = String(fieldValue || "").includes(rule.value);
        message = passed 
          ? `${rule.field} contains "${rule.value}"` 
          : `${rule.field} ("${fieldValue}") does not contain "${rule.value}"`;
        break;
        
      case "greaterThan":
        const numValue = parseFloat(rule.value);
        const numField = parseFloat(fieldValue);
        passed = !isNaN(numField) && !isNaN(numValue) && numField > numValue;
        message = passed 
          ? `${rule.field} (${numField}) is greater than ${numValue}` 
          : `${rule.field} (${numField}) is not greater than ${numValue}`;
        break;
        
      case "lessThan":
        const ltNumValue = parseFloat(rule.value);
        const ltNumField = parseFloat(fieldValue);
        passed = !isNaN(ltNumField) && !isNaN(ltNumValue) && ltNumField < ltNumValue;
        message = passed 
          ? `${rule.field} (${ltNumField}) is less than ${ltNumValue}` 
          : `${rule.field} (${ltNumField}) is not less than ${ltNumValue}`;
        break;
        
      case "notEmpty":
        passed = fieldValue !== null && fieldValue !== undefined && String(fieldValue).trim() !== "";
        message = passed 
          ? `${rule.field} is not empty` 
          : `${rule.field} is empty or missing`;
        break;
        
      case "matches":
        try {
          const regex = new RegExp(rule.value);
          passed = regex.test(String(fieldValue || ""));
          message = passed 
            ? `${rule.field} matches pattern "${rule.value}"` 
            : `${rule.field} ("${fieldValue}") does not match pattern "${rule.value}"`;
        } catch (e) {
          passed = false;
          message = `Invalid regex pattern: "${rule.value}"`;
        }
        break;
        
      default:
        passed = false;
        message = `Unknown operator: ${rule.operator}`;
    }
  } catch (error) {
    passed = false;
    message = `Error validating rule: ${error.message}`;
  }

  return {
    ruleId: rule.id,
    passed,
    message
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { rules, invoice }: ValidationRequest = await req.json();

    console.log('Validating rules:', rules.length);
    console.log('Invoice data:', JSON.stringify(invoice, null, 2));

    if (!rules || !Array.isArray(rules) || rules.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "No rules provided",
          results: []
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
    }

    if (!invoice || typeof invoice !== 'object') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Invalid invoice data",
          results: []
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
    }

    // Validate each rule
    const results: ValidationResult[] = rules.map(rule => validateRule(rule, invoice));
    
    // Check if all rules passed
    const allPassed = results.every(result => result.passed);
    
    console.log('Validation results:', results);

    return new Response(
      JSON.stringify({
        success: allPassed,
        results
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Validation error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: `Validation failed: ${error.message}`,
        results: []
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
})