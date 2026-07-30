import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { RiskRule, TradeOrder, AgentTradingLog } from '../types.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dqhujeggbndwcavzgnhm.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxaHVqZWdnYm5kd2NhdnpnbmhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzNzM2MDcsImV4cCI6MjEwMDk0OTYwN30.ixW2V-WWQnOB8q4REtuF1KK3-bULS7fWw5NIg43EpV4';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!client && SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
      client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch (err) {
      console.error('Failed to initialize Supabase client:', err);
    }
  }
  return client;
}

export const supabaseService = {
  // Sync risk rules with Supabase
  async fetchRiskRules(): Promise<RiskRule[] | null> {
    const sb = getSupabase();
    if (!sb) return null;
    try {
      const { data, error } = await sb.from('risk_rules').select('*').order('created_at', { ascending: true });
      if (error || !data || data.length === 0) return null;
      return data.map((r: any) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        isEnabled: r.is_enabled,
        value: Number(r.value),
        unit: r.unit,
      }));
    } catch (err) {
      console.error('Supabase fetchRiskRules error:', err);
      return null;
    }
  },

  async saveRiskRules(rules: RiskRule[]): Promise<boolean> {
    const sb = getSupabase();
    if (!sb) return false;
    try {
      const formatted = rules.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        is_enabled: r.isEnabled,
        value: r.value,
        unit: r.unit,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await sb.from('risk_rules').upsert(formatted, { onConflict: 'id' });
      if (error) {
        console.error('Supabase saveRiskRules error:', error);
        return false;
      }
      return true;
    } catch (err) {
      console.error('Supabase saveRiskRules exception:', err);
      return false;
    }
  },

  // Save order to history
  async logOrder(order: TradeOrder): Promise<boolean> {
    const sb = getSupabase();
    if (!sb) return false;
    try {
      const { error } = await sb.from('trade_orders').upsert({
        id: order.id,
        symbol: order.symbol,
        type: order.type,
        lot: order.lot,
        sl: order.sl || null,
        tp: order.tp || null,
        status: order.status,
        source: order.source,
        created_at: new Date(order.createdAt).toISOString(),
        executed_at: order.executedAt ? new Date(order.executedAt).toISOString() : null,
        execution_price: order.executionPrice || null,
        error: order.error || null,
      });
      return !error;
    } catch (err) {
      console.error('Supabase logOrder error:', err);
      return false;
    }
  },

  // Log trading events
  async logTradingEvent(log: AgentTradingLog): Promise<boolean> {
    const sb = getSupabase();
    if (!sb) return false;
    try {
      const { error } = await sb.from('trading_logs').insert({
        id: log.id,
        timestamp: new Date(log.timestamp).toISOString(),
        type: log.type,
        message: log.message,
      });
      return !error;
    } catch (err) {
      console.error('Supabase logTradingEvent error:', err);
      return false;
    }
  },
};
