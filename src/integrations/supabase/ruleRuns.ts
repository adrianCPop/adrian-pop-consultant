import { SUPABASE_URL, SUPABASE_ANON_KEY } from './constants';

export async function logRuleRun(data: {
  invoice: Record<string, unknown>;
  rules: unknown[];
  result: unknown;
  user_id?: string;
}) {
  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/rule_runs`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!resp.ok) {
      console.error('Failed to log rule run', await resp.text());
    }
  } catch (err) {
    console.error('Failed to log rule run', err);
  }
}

