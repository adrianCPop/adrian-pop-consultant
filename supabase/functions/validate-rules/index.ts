import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

interface Rule {
  field: string
  operator: string
  value: unknown
  action?: string
}

interface ValidationRequest {
  rules: Rule[]
  invoice: Record<string, unknown>
}

interface RuleLogEntry {
  rule: number
  passed: boolean
}

interface ValidationResponse {
  isValid: boolean
  errors: string[]
  warnings: string[]
  ruleLog: RuleLogEntry[]
}

function resolvePath(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, part) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[part] : undefined), obj)
}

function compare(operator: string, a: unknown, b: unknown): boolean {
  switch (operator) {
    case '>':
    case 'greaterThan':
      return a > b
    case '<':
    case 'lessThan':
      return a < b
    case '>=':
      return a >= b
    case '<=':
      return a <= b
    case '==':
    case 'equals':
      return a == b
    case '===':
      return a === b
    case '!=':
      return a != b
    case '!==':
      return a !== b
    case 'notEmpty':
      return a !== null && a !== undefined && String(a).trim() !== ''
    case 'contains':
      return String(a ?? '').includes(String(b))
    case 'matches':
      try {
        const r = new RegExp(String(b))
        return r.test(String(a ?? ''))
      } catch {
        return false
      }
    default:
      return false
  }
}

function validateInvoice(rules: Rule[], invoice: Record<string, unknown>): ValidationResponse {
  const errors: string[] = []
  const warnings: string[] = []
  const ruleLog: RuleLogEntry[] = []

  rules.forEach((rule, idx) => {
    const left = resolvePath(invoice, rule.field)
    const passed = compare(rule.operator, left, rule.value)
    ruleLog.push({ rule: idx + 1, passed })
    if (!passed) {
      const msg = `Rule failed: ${rule.field} ${rule.operator} ${rule.value}`
      if (rule.action === 'warning') warnings.push(msg)
      else errors.push(msg)
    }
  })

  return { isValid: errors.length === 0, errors, warnings, ruleLog }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { rules, invoice }: ValidationRequest = await req.json()
    const result = validateInvoice(rules, invoice)

    // Enhanced error handling for database logging
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )
      
      const { error: insertError } = await supabase.from('rule_runs').insert({
        created_at: new Date().toISOString(),
        is_valid: result.isValid,
        errors: result.errors,
        warnings: result.warnings,
      })
      
      if (insertError) {
        console.error('Database logging failed:', insertError)
        // Continue processing but log the failure
      }
    } catch (e) {
      console.error('Failed to log rule run to database:', e)
      // Don't fail the entire request due to logging issues
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Validation error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
