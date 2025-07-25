import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

interface Props {
  topic: string;
}

export function AIResearchButton({ topic }: Props) {
  const [loading, setLoading] = useState(false);
  const [alertId, setAlertId] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!alertId) return;

    const channel = supabase
      .channel(`fiscal_alert_${alertId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'fiscal_alerts',
          filter: `id=eq.${alertId}`
        },
        payload => {
          if (payload.new.ai_summary) {
            setDone(true);
            setLoading(false);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [alertId]);

  const handleClick = async () => {
    setLoading(true);
    setDone(false);
    const id = uuidv4();
    setAlertId(id);

    try {
      const res = await fetch(
        'https://n8n.srv923194.hstgr.cloud/webhook/ai-topic-query',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic, fiscal_alert_id: id })
        }
      );

      const data = await res.json().catch(() => null);
      if (data && data.fiscal_alert_id) {
        setAlertId(data.fiscal_alert_id);
      }
    } catch (err) {
      console.error('Error triggering webhook', err);
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleClick} disabled={loading}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {done ? 'Done' : loading ? 'Processing...' : 'AI Research'}
    </Button>
  );
}
