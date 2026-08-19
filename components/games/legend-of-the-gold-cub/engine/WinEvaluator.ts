import { SymbolId, WinLine, WinResult } from '../types';
import { PAYTABLE, PAYLINES, SYMBOL_CONFIG, NUM_PAYLINES, FREE_SPINS_AWARD } from '../myGameConfig';

function payFor(symbol: SymbolId, count: number): number {
  return (PAYTABLE[symbol] as Record<number, number | undefined>)[count] ?? 0;
}

// Best left-to-right interpretation of a payline, wilds substituting for any
// paying symbol (never scatter). Two candidates are compared and the
// higher-paying one wins:
//   1. anchor run — leading wilds + the first real symbol's run
//   2. wild run alone — 3+ leading wilds read as the best-paying symbol
// e.g. [W, W, W, camo, tiger] pays as 3× gold tiger (20×), not 4× camo (2×).
function bestLineWin(lineSymbols: SymbolId[]): { symbol: SymbolId; count: number; pay: number } | null {
  let wildRun = 0;
  while (wildRun < lineSymbols.length && SYMBOL_CONFIG[lineSymbols[wildRun]].isWild) wildRun++;

  let best: { symbol: SymbolId; count: number; pay: number } | null = null;
  const consider = (symbol: SymbolId, count: number) => {
    const pay = payFor(symbol, count);
    if (count >= 3 && pay > 0 && (best === null || pay > best.pay)) {
      best = { symbol, count, pay };
    }
  };

  // 1. Anchor interpretation
  const anchor = lineSymbols[wildRun];
  if (anchor !== undefined && !SYMBOL_CONFIG[anchor].isScatter) {
    let count = wildRun;
    while (
      count < lineSymbols.length &&
      (lineSymbols[count] === anchor || SYMBOL_CONFIG[lineSymbols[count]].isWild)
    ) {
      count++;
    }
    consider(anchor, count);
  }

  // 2. Wild run as the best-paying substitute
  if (wildRun >= 3) {
    for (const id of Object.keys(PAYTABLE) as SymbolId[]) {
      if (SYMBOL_CONFIG[id].isWild || SYMBOL_CONFIG[id].isScatter) continue;
      consider(id, wildRun);
    }
  }

  return best;
}

export function evaluateWins(
  visibleSymbols: SymbolId[][], // [reel][row]
  betPerLine: number,
): WinResult {
  const lines: WinLine[] = [];
  let totalWin = 0;

  // Evaluate each payline
  for (let lineIdx = 0; lineIdx < PAYLINES.length; lineIdx++) {
    const line = PAYLINES[lineIdx];
    const lineSymbols = line.map((row, reel) => visibleSymbols[reel][row]);
    const result = bestLineWin(lineSymbols);

    if (result) {
      const win = result.pay * betPerLine;
      totalWin += win;
      lines.push({
        lineIndex: lineIdx,
        symbol: result.symbol,
        count: result.count,
        win,
        positions: line.slice(0, result.count),
      });
    }
  }

  // Scatter: count golden_cub anywhere on all 15 visible cells
  const scatterCount = visibleSymbols.flat().filter(s => SYMBOL_CONFIG[s].isScatter).length;
  let scatterWin = 0;
  if (scatterCount >= 3) {
    const scatterPay = (PAYTABLE['golden_cub'] as Record<number, number | undefined>)[scatterCount] ?? 0;
    // Scatter pays on total bet (all lines)
    scatterWin = scatterPay * betPerLine * NUM_PAYLINES;
    totalWin += scatterWin;
  }

  const triggeredFreeSpins = scatterCount >= 3;
  const freeSpinsAwarded = triggeredFreeSpins
    ? FREE_SPINS_AWARD[Math.min(scatterCount, 5)] ?? 0
    : 0;

  return {
    lines,
    totalWin,
    scatterCount,
    triggeredFreeSpins,
    freeSpinsAwarded,
    bigWin: totalWin >= betPerLine * 20,
    megaWin: totalWin >= betPerLine * 50,
  };
}
