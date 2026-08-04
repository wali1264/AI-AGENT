import {
  UnifiedSnapshot,
  TradeOrder,
  PositionModificationRequest,
  TrailingStopConfig,
  ExecutionEngineResult,
  PositionInfo,
} from '../types.js';

export class ExecutionEngine {
  private defaultTrailingConfig: TrailingStopConfig = {
    enableBreakeven: true,
    breakevenProfitDistance: 1.50, // $1.50 in Gold (150 points)
    enableTrailingStop: true,
    trailingStep: 1.20, // $1.20 dynamic ATR trail
    minTrailActivationProfit: 2.50, // Activation threshold ($2.50 profit)
  };

  /**
   * Evaluates the unified snapshot to manage order execution, position trailing stops, and risk overrides.
   */
  public processExecution(
    snapshot: UnifiedSnapshot,
    userActiveFlag: boolean = false,
    customTrailingConfig?: Partial<TrailingStopConfig>
  ): ExecutionEngineResult {
    const logs: string[] = [];
    const ordersToDispatch: TradeOrder[] = [];
    const modificationsToDispatch: PositionModificationRequest[] = [];
    const config: TrailingStopConfig = { ...this.defaultTrailingConfig, ...customTrailingConfig };

    const timestamp = new Date().toISOString();
    const market = snapshot.market;
    const ask = market.ask || 0;
    const bid = market.bid || 0;
    const currentPositions = snapshot.positions || [];
    const riskAssessment = snapshot.riskAssessment;
    const strategySignal = snapshot.strategySignal;
    const aiAnalysis = snapshot.aiAnalysis;

    logs.push(`[${timestamp}] پردازش موتور اجرای معاملات (ExecutionEngine) آغاز شد.`);

    // 1. Safety Check: Is Agent Trading Active & Connected?
    if (!userActiveFlag) {
      logs.push('موتور معامله غیرفعال است (محیط در حالت نظارتی یا دستی قرار دارد).');
      return {
        actionExecuted: false,
        ordersToDispatch: [],
        modificationsToDispatch: [],
        executionSummaryPersian: 'معامله غیرفعال است (سیستم در حالت نظارتی قرار دارد).',
        logs,
        timestamp,
      };
    }

    // 2. Emergency Close Check: Risk Engine Rejection or AI Emergency Signal
    if (aiAnalysis?.decision === 'CLOSE_ALL') {
      logs.push('سیگنال اضطراری بستن تمامی پوزیشن‌ها از طرف ایجنت هوشمند دریافت شد.');
      if (currentPositions.length > 0) {
        const closeAllOrder: TradeOrder = {
          id: `ord_closeall_${Date.now()}`,
          symbol: market.symbol || 'XAUUSD.m',
          type: 'CLOSE_ALL',
          lot: 0,
          status: 'pending',
          createdAt: timestamp,
          source: 'ai_agent',
        };
        ordersToDispatch.push(closeAllOrder);
        logs.push(`سفارش بستن اضطراری تمام ${currentPositions.length} پوزیشن صادر شد.`);
      }
    }

    if (riskAssessment && !riskAssessment.isAllowed && riskAssessment.recommendation === 'REJECT') {
      logs.push('موتور مدیریت ریسک اجازه ورود به معامله جدید را صادر نکرد.');
    }

    // 3. Trailing Stop & Breakeven Position Management
    for (const pos of currentPositions) {
      this.evaluatePositionProtection(pos, ask, bid, config, modificationsToDispatch, logs);
    }

    // 4. Signal-Driven Auto Order Generation (STRICT: Executed ONLY if user explicitly enabled autonomous trading)
    if (userActiveFlag && riskAssessment?.isAllowed && strategySignal && strategySignal.action !== 'HOLD') {
      const signalAction = strategySignal.action;
      const confidence = strategySignal.confidenceScore;

      // Ensure no duplicate open position in the same direction
      const existingSameDirection = currentPositions.find(
        (p) => p.direction === signalAction && p.symbol === strategySignal.symbol
      );

      if (!existingSameDirection) {
        if (confidence >= 70) {
          const safeLot = Math.min(strategySignal.lot, riskAssessment.maxAllowedLot || 0.05);
          const entryPrice = signalAction === 'BUY' ? ask : bid;

          const newOrder: TradeOrder = {
            id: `ord_${signalAction.toLowerCase()}_${Date.now()}`,
            clientOrderId: `cl_${Date.now()}`,
            symbol: strategySignal.symbol,
            type: signalAction,
            lot: Number(safeLot.toFixed(2)),
            sl: strategySignal.sl,
            tp: strategySignal.tp,
            status: 'pending',
            createdAt: timestamp,
            executionPrice: entryPrice,
            source: 'ai_agent',
          };

          ordersToDispatch.push(newOrder);
          logs.push(
            `سفارش جدید ${signalAction} به حجم ${safeLot} لات با SL: $${strategySignal.sl} و TP: $${strategySignal.tp} صادر شد (میزان اطمینان: ${confidence}٪).`
          );
        } else {
          logs.push(`سیگنال ${signalAction} به دلیل اطمینان پایین (${confidence}٪ < 70٪) صادر نشد.`);
        }
      } else {
        logs.push(`یک پوزیشن فعال در جهت ${signalAction} در حال حاضر وجود دارد. سفارش تکراری صادر نشد.`);
      }
    }

    const actionExecuted = ordersToDispatch.length > 0 || modificationsToDispatch.length > 0;
    const executionSummaryPersian = this.generatePersianSummary(ordersToDispatch, modificationsToDispatch, currentPositions.length);

    return {
      actionExecuted,
      ordersToDispatch,
      modificationsToDispatch,
      executionSummaryPersian,
      logs,
      timestamp,
    };
  }

  /**
   * Applies Breakeven and Dynamic Trailing Stop rules to active positions.
   */
  private evaluatePositionProtection(
    pos: PositionInfo,
    ask: number,
    bid: number,
    config: TrailingStopConfig,
    modifications: PositionModificationRequest[],
    logs: string[]
  ) {
    const isBuy = pos.direction === 'BUY';
    const currentPrice = isBuy ? bid : ask;
    const entryPrice = pos.entryPrice;
    const currentSL = pos.sl;

    // Calculate profit distance in price terms
    const profitDistance = isBuy ? currentPrice - entryPrice : entryPrice - currentPrice;

    // 1. Breakeven Protection Rule
    if (config.enableBreakeven && profitDistance >= config.breakevenProfitDistance) {
      const isBreakevenAlreadySet = isBuy ? currentSL >= entryPrice : currentSL > 0 && currentSL <= entryPrice;

      if (!isBreakevenAlreadySet) {
        const safeBreakevenSL = isBuy ? Number((entryPrice + 0.10).toFixed(2)) : Number((entryPrice - 0.10).toFixed(2));

        modifications.push({
          ticket: pos.ticket,
          symbol: pos.symbol,
          action: 'BREAKEVEN',
          newSL: safeBreakevenSL,
          newTP: pos.tp,
          reason: `انتقال حد ضرر به نقطه ورود (ریسک صفر) پس از سود $${profitDistance.toFixed(2)}`,
        });

        logs.push(
          `قانون ریسک صفر (Breakeven): حد ضرر پوزیشن #${pos.ticket} به قیمت ورود $${safeBreakevenSL} منتقل شد.`
        );
        return;
      }
    }

    // 2. Dynamic Trailing Stop Rule
    if (config.enableTrailingStop && profitDistance >= config.minTrailActivationProfit) {
      if (isBuy) {
        const idealSL = Number((bid - config.trailingStep).toFixed(2));
        if (idealSL > currentSL + 0.20) {
          modifications.push({
            ticket: pos.ticket,
            symbol: pos.symbol,
            action: 'UPDATE_SL_TP',
            newSL: idealSL,
            newTP: pos.tp,
            reason: `ارتقای حد ضرر متحرک (Trailing Stop) به $${idealSL} (سود فعلی: $${profitDistance.toFixed(2)})`,
          });
          logs.push(`تریلینگ استاپ پوزیشن خرید #${pos.ticket}: حد ضرر جدید $${idealSL}`);
        }
      } else {
        const idealSL = Number((ask + config.trailingStep).toFixed(2));
        if (currentSL === 0 || idealSL < currentSL - 0.20) {
          modifications.push({
            ticket: pos.ticket,
            symbol: pos.symbol,
            action: 'UPDATE_SL_TP',
            newSL: idealSL,
            newTP: pos.tp,
            reason: `ارتقای حد ضرر متحرک (Trailing Stop) به $${idealSL} (سود فعلی: $${profitDistance.toFixed(2)})`,
          });
          logs.push(`تریلینگ استاپ پوزیشن فروش #${pos.ticket}: حد ضرر جدید $${idealSL}`);
        }
      }
    }
  }

  private generatePersianSummary(
    orders: TradeOrder[],
    modifications: PositionModificationRequest[],
    activePositionCount: number
  ): string {
    if (orders.length === 0 && modifications.length === 0) {
      return `موتور اجرا: تمامی ${activePositionCount} پوزیشن فعال تحت نظارت هستند. شرایط جدید برای تغییر یا ورود صادر نشد.`;
    }

    const parts: string[] = [];
    if (orders.length > 0) {
      const orderTypes = orders.map((o) => `${o.type} (${o.lot} لات)`).join(', ');
      parts.push(`صدور سفارش معاملاتی جدید: ${orderTypes}`);
    }
    if (modifications.length > 0) {
      const mods = modifications.map((m) => `تیکت #${m.ticket}: ${m.reason}`).join(' | ');
      parts.push(`به‌روزرسانی محافظتی پوزیشن‌ها: ${mods}`);
    }

    return parts.join(' - ');
  }
}

export const executionEngine = new ExecutionEngine();
