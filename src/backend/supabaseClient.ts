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

  // Fetch past trade orders from Supabase
  async fetchTradeOrders(): Promise<TradeOrder[] | null> {
    const sb = getSupabase();
    if (!sb) return null;
    try {
      const { data, error } = await sb.from('trade_orders').select('*').order('created_at', { ascending: false }).limit(100);
      if (error || !data) return null;
      return data.map((o: any) => ({
        id: o.id,
        symbol: o.symbol,
        type: o.type,
        lot: Number(o.lot),
        sl: o.sl ? Number(o.sl) : undefined,
        tp: o.tp ? Number(o.tp) : undefined,
        status: o.status,
        createdAt: o.created_at,
        executedAt: o.executed_at || undefined,
        executionPrice: o.execution_price ? Number(o.execution_price) : undefined,
        error: o.error || undefined,
        source: o.source || 'user_manual',
      }));
    } catch (err) {
      console.error('Supabase fetchTradeOrders error:', err);
      return null;
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

  // Fetch trading logs from Supabase
  async fetchTradingLogs(): Promise<AgentTradingLog[] | null> {
    const sb = getSupabase();
    if (!sb) return null;
    try {
      const { data, error } = await sb.from('trading_logs').select('*').order('timestamp', { ascending: false }).limit(100);
      if (error || !data) return null;
      return data.map((l: any) => ({
        id: l.id,
        timestamp: l.timestamp,
        type: l.type,
        message: l.message,
      }));
    } catch (err) {
      console.error('Supabase fetchTradingLogs error:', err);
      return null;
    }
  },

  // Memory & Instructions Persistence
  async fetchAgentMemory(): Promise<{ id: string; category: string; content: string; createdAt: string }[] | null> {
    const sb = getSupabase();
    if (!sb) return null;
    try {
      const { data, error } = await sb.from('agent_memory').select('*').order('created_at', { ascending: false });
      if (error || !data) return null;
      return data.map((m: any) => ({
        id: m.id,
        category: m.category || 'general',
        content: m.content,
        createdAt: m.created_at,
      }));
    } catch (err) {
      console.error('Supabase fetchAgentMemory error:', err);
      return null;
    }
  },

  async saveAgentMemoryNote(note: { id: string; category: string; content: string }): Promise<boolean> {
    const sb = getSupabase();
    if (!sb) return false;
    try {
      const { error } = await sb.from('agent_memory').upsert({
        id: note.id,
        category: note.category,
        content: note.content,
        created_at: new Date().toISOString(),
      });
      return !error;
    } catch (err) {
      console.error('Supabase saveAgentMemoryNote error:', err);
      return false;
    }
  },

  async deleteAgentMemoryNote(id: string): Promise<boolean> {
    const sb = getSupabase();
    if (!sb) return false;
    try {
      const { error } = await sb.from('agent_memory').delete().eq('id', id);
      return !error;
    } catch (err) {
      console.error('Supabase deleteAgentMemoryNote error:', err);
      return false;
    }
  },

  // Chat History Persistence
  async fetchChatMessages(): Promise<{ id: string; sender: 'user' | 'agent'; text: string; timestamp: string }[] | null> {
    const sb = getSupabase();
    if (!sb) return null;
    try {
      const { data, error } = await sb.from('agent_chat_messages').select('*').order('timestamp', { ascending: true }).limit(100);
      if (error || !data) return null;
      return data.map((msg: any) => ({
        id: msg.id,
        sender: msg.sender,
        text: msg.text,
        timestamp: msg.timestamp,
      }));
    } catch (err) {
      console.error('Supabase fetchChatMessages error:', err);
      return null;
    }
  },

  async saveChatMessage(msg: { id: string; sender: 'user' | 'agent'; text: string; timestamp: string }): Promise<boolean> {
    const sb = getSupabase();
    if (!sb) return false;
    try {
      const { error } = await sb.from('agent_chat_messages').insert({
        id: msg.id,
        sender: msg.sender,
        text: msg.text,
        timestamp: msg.timestamp,
      });
      return !error;
    } catch (err) {
      console.error('Supabase saveChatMessage error:', err);
      return false;
    }
  },
};
