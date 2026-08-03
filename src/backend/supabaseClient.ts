import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { RiskRule, TradeOrder, AgentTradingLog, TradeJournalEntry, AgentKnowledgeRule } from '../types.js';

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

  // Trade Journal Persistence
  async logTradeJournal(entry: TradeJournalEntry): Promise<boolean> {
    const sb = getSupabase();
    if (!sb) return false;
    try {
      const { error } = await sb.from('trade_journal').upsert({
        id: entry.id,
        account_id: entry.accountId,
        account_number: entry.accountNumber || null,
        symbol: entry.symbol,
        timeframe: entry.timeframe,
        timestamp: entry.timestamp,
        ask: entry.ask,
        bid: entry.bid,
        spread: entry.spread,
        candles_summary: entry.candlesSummary ? JSON.stringify(entry.candlesSummary) : null,
        indicators_snapshot: entry.indicatorsSnapshot ? JSON.stringify(entry.indicatorsSnapshot) : null,
        decision: entry.decision,
        confidence: entry.confidence,
        persian_analysis: entry.persianAnalysis || null,
        english_analysis: entry.englishAnalysis || null,
        confluence_reasons: entry.confluenceReasons ? JSON.stringify(entry.confluenceReasons) : null,
        order_type: entry.orderType || null,
        lot: entry.lot || null,
        entry_price: entry.entryPrice || null,
        sl: entry.sl || null,
        tp: entry.tp || null,
        exit_price: entry.exitPrice || null,
        exit_time: entry.exitTime || null,
        pnl_usd: entry.pnlUsd || null,
        pnl_points: entry.pnlPoints || null,
        status: entry.status,
        execution_error: entry.executionError || null,
        strategy_name: entry.strategyName || null,
        risk_score: entry.riskScore || null,
        news_filter_passed: entry.newsFilterPassed ?? true,
      });
      if (error) {
        console.warn('Supabase trade_journal notice:', error.message);
      }
      return !error;
    } catch (err) {
      console.error('Supabase logTradeJournal exception:', err);
      return false;
    }
  },

  async fetchTradeJournal(accountId?: string): Promise<TradeJournalEntry[] | null> {
    const sb = getSupabase();
    if (!sb) return null;
    try {
      let query = sb.from('trade_journal').select('*').order('timestamp', { ascending: false }).limit(100);
      if (accountId) {
        query = query.eq('account_id', accountId);
      }
      const { data, error } = await query;
      if (error || !data) return null;
      return data.map((j: any) => ({
        id: j.id,
        accountId: j.account_id || 'account_default',
        accountNumber: j.account_number ? Number(j.account_number) : undefined,
        symbol: j.symbol || 'XAUUSD',
        timeframe: j.timeframe || 'M15',
        timestamp: j.timestamp,
        ask: Number(j.ask || 0),
        bid: Number(j.bid || 0),
        spread: Number(j.spread || 0),
        candlesSummary: j.candles_summary ? (typeof j.candles_summary === 'string' ? JSON.parse(j.candles_summary) : j.candles_summary) : undefined,
        indicatorsSnapshot: j.indicators_snapshot ? (typeof j.indicators_snapshot === 'string' ? JSON.parse(j.indicators_snapshot) : j.indicators_snapshot) : undefined,
        decision: j.decision,
        confidence: Number(j.confidence || 0),
        persianAnalysis: j.persian_analysis,
        englishAnalysis: j.english_analysis,
        confluenceReasons: j.confluence_reasons ? (typeof j.confluence_reasons === 'string' ? JSON.parse(j.confluence_reasons) : j.confluence_reasons) : undefined,
        orderType: j.order_type,
        lot: j.lot ? Number(j.lot) : undefined,
        entryPrice: j.entry_price ? Number(j.entry_price) : undefined,
        sl: j.sl ? Number(j.sl) : undefined,
        tp: j.tp ? Number(j.tp) : undefined,
        exitPrice: j.exit_price ? Number(j.exit_price) : undefined,
        exitTime: j.exit_time,
        pnlUsd: j.pnl_usd ? Number(j.pnl_usd) : undefined,
        pnlPoints: j.pnl_points ? Number(j.pnl_points) : undefined,
        status: j.status || 'PROPOSED',
        executionError: j.execution_error,
        strategyName: j.strategy_name,
        riskScore: j.risk_score ? Number(j.risk_score) : undefined,
        newsFilterPassed: j.news_filter_passed,
      }));
    } catch (err) {
      console.error('Supabase fetchTradeJournal exception:', err);
      return null;
    }
  },

  // Memory & Instructions Persistence (Multi-Account Isolated)
  async fetchAgentMemory(accountId?: string): Promise<{ id: string; category: string; content: string; createdAt: string; accountId?: string }[] | null> {
    const sb = getSupabase();
    if (!sb) return null;
    try {
      let query = sb.from('agent_memory').select('*').order('created_at', { ascending: false });
      if (accountId) {
        query = query.or(`account_id.eq.${accountId},account_id.is.null`);
      }
      const { data, error } = await query;
      if (error || !data) return null;
      return data.map((m: any) => ({
        id: m.id,
        category: m.category || 'general',
        content: m.content,
        createdAt: m.created_at,
        accountId: m.account_id || undefined,
      }));
    } catch (err) {
      console.error('Supabase fetchAgentMemory error:', err);
      return null;
    }
  },

  async saveAgentMemoryNote(note: { id: string; category: string; content: string; accountId?: string }): Promise<boolean> {
    const sb = getSupabase();
    if (!sb) return false;
    try {
      const payload: any = {
        id: note.id,
        category: note.category,
        content: note.content,
        created_at: new Date().toISOString(),
      };
      if (note.accountId) {
        payload.account_id = note.accountId;
      }
      const { error } = await sb.from('agent_memory').upsert(payload);
      if (error && note.accountId) {
        // Fallback if account_id column not present in schema
        delete payload.account_id;
        const { error: errFallback } = await sb.from('agent_memory').upsert(payload);
        return !errFallback;
      }
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

  // Chat History Persistence (Multi-Account Isolated & Compact Context Window)
  async fetchChatMessages(accountId?: string): Promise<{ id: string; sender: 'user' | 'agent'; text: string; timestamp: string; accountId?: string }[] | null> {
    const sb = getSupabase();
    if (!sb) return null;
    try {
      let query = sb.from('agent_chat_messages').select('*').order('timestamp', { ascending: true }).limit(100);
      if (accountId) {
        query = query.or(`account_id.eq.${accountId},account_id.is.null`);
      }
      const { data, error } = await query;
      if (error || !data) return null;
      return data.map((msg: any) => ({
        id: msg.id || `chat_${Date.now()}_${Math.random()}`,
        sender: msg.sender || 'agent',
        text: msg.text || '',
        timestamp: msg.timestamp || msg.created_at || new Date().toISOString(),
        accountId: msg.account_id || undefined,
      }));
    } catch (err) {
      console.error('Supabase fetchChatMessages error:', err);
      return null;
    }
  },

  async saveChatMessage(msg: { id: string; sender: 'user' | 'agent'; text: string; timestamp: string; accountId?: string }): Promise<boolean> {
    const sb = getSupabase();
    if (!sb) return false;
    try {
      const payload: any = {
        id: msg.id,
        sender: msg.sender,
        text: msg.text,
        timestamp: msg.timestamp,
        created_at: msg.timestamp,
        account_id: msg.accountId || null,
      };
      const { error } = await sb.from('agent_chat_messages').upsert(payload);
      if (error) {
        delete payload.account_id;
        const { error: err2 } = await sb.from('agent_chat_messages').upsert(payload);
        return !err2;
      }
      return true;
    } catch (err) {
      console.error('Supabase saveChatMessage error:', err);
      return false;
    }
  },

  // Knowledge Layer Persistence (Hermes Knowledge Rules & Empirical Insights)
  async fetchAgentKnowledge(accountId?: string): Promise<AgentKnowledgeRule[] | null> {
    const sb = getSupabase();
    if (!sb) return null;
    try {
      let query = sb.from('agent_knowledge').select('*').order('confidence_score', { ascending: false });
      if (accountId) {
        query = query.or(`account_id.eq.${accountId},account_id.is.null`);
      }
      const { data, error } = await query;
      if (error || !data) return null;
      return data.map((k: any) => ({
        id: k.id,
        ruleCode: k.rule_code,
        title: k.title,
        descriptionPersian: k.description_persian,
        sampleSize: Number(k.sample_size || 0),
        winRateImpact: Number(k.win_rate_impact || 0),
        confidenceScore: Number(k.confidence_score || 0),
        category: k.category || 'GENERAL',
        isEnabled: k.is_enabled ?? true,
        createdAt: k.created_at,
        updatedAt: k.updated_at,
        accountId: k.account_id || undefined,
      }));
    } catch (err) {
      console.error('Supabase fetchAgentKnowledge error:', err);
      return null;
    }
  },

  async saveKnowledgeRule(rule: AgentKnowledgeRule): Promise<boolean> {
    const sb = getSupabase();
    if (!sb) return false;
    try {
      const payload: any = {
        id: rule.id,
        rule_code: rule.ruleCode,
        title: rule.title,
        description_persian: rule.descriptionPersian,
        sample_size: rule.sampleSize,
        win_rate_impact: rule.winRateImpact,
        confidence_score: rule.confidenceScore,
        category: rule.category,
        is_enabled: rule.isEnabled,
        created_at: rule.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        account_id: rule.accountId || null,
      };
      const { error } = await sb.from('agent_knowledge').upsert(payload);
      if (error && rule.accountId) {
        delete payload.account_id;
        const { error: errFallback } = await sb.from('agent_knowledge').upsert(payload);
        return !errFallback;
      }
      return !error;
    } catch (err) {
      console.error('Supabase saveKnowledgeRule error:', err);
      return false;
    }
  },

  async toggleKnowledgeRule(id: string, isEnabled: boolean): Promise<boolean> {
    const sb = getSupabase();
    if (!sb) return false;
    try {
      const { error } = await sb.from('agent_knowledge').update({ is_enabled: isEnabled, updated_at: new Date().toISOString() }).eq('id', id);
      return !error;
    } catch (err) {
      console.error('Supabase toggleKnowledgeRule error:', err);
      return false;
    }
  },

  async deleteKnowledgeRule(id: string): Promise<boolean> {
    const sb = getSupabase();
    if (!sb) return false;
    try {
      const { error } = await sb.from('agent_knowledge').delete().eq('id', id);
      return !error;
    } catch (err) {
      console.error('Supabase deleteKnowledgeRule error:', err);
      return false;
    }
  },
};
