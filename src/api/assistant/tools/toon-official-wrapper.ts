/**
 * Official TOON Library Wrapper
 * Integrates the official @toon-format/toon library
 */

import { encode, decode } from "@toon-format/toon";

/**
 * Convert JSON to TOON format using official library
 */
export function toTOON(data: any): string {
  return encode(data, {
    indent: 2,
    delimiter: ",",
    keyFolding: "safe", // Enable key folding for compact output
  });
}

/**
 * Convert TOON format back to JSON
 */
export function fromTOON(toonString: string): any {
  return decode(toonString, {
    indent: 2,
    expandPaths: "safe", // Match keyFolding
    strict: true,
  });
}

/**
 * Get token count estimation (rough approximation)
 * Rule of thumb: ~4 characters = 1 token for English text
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Calculate token savings percentage
 */
export function calculateSavings(original: string, optimized: string): {
  original: number;
  optimized: number;
  saved: number;
  percentage: number;
} {
  const originalTokens = estimateTokens(original);
  const optimizedTokens = estimateTokens(optimized);
  const saved = originalTokens - optimizedTokens;
  const percentage = Math.round((saved / originalTokens) * 100);

  return {
    original: originalTokens,
    optimized: optimizedTokens,
    saved,
    percentage,
  };
}

/**
 * TOON Statistics tracker for monitoring performance
 */
class TOONStats {
  private totalOriginalTokens = 0;
  private totalOptimizedTokens = 0;
  private callCount = 0;

  track(original: string, optimized: string) {
    this.totalOriginalTokens += estimateTokens(original);
    this.totalOptimizedTokens += estimateTokens(optimized);
    this.callCount++;
  }

  getStats() {
    const saved = this.totalOriginalTokens - this.totalOptimizedTokens;
    const percentage =
      this.totalOriginalTokens > 0
        ? Math.round((saved / this.totalOriginalTokens) * 100)
        : 0;

    // Estimate cost savings (Claude Sonnet 4: $3 per 1M input tokens)
    const costSavings = (saved / 1000000) * 3;

    return {
      totalCalls: this.callCount,
      totalOriginalTokens: this.totalOriginalTokens,
      totalOptimizedTokens: this.totalOptimizedTokens,
      totalSaved: saved,
      percentageSaved: percentage,
      estimatedCostSavings: costSavings,
    };
  }

  reset() {
    this.totalOriginalTokens = 0;
    this.totalOptimizedTokens = 0;
    this.callCount = 0;
  }

  printStats() {
    const stats = this.getStats();
    console.log("\n📊 TOON Performance Statistics (Official Library):");
    console.log(`   Total calls: ${stats.totalCalls}`);
    console.log(
      `   Original tokens: ${stats.totalOriginalTokens.toLocaleString()}`
    );
    console.log(
      `   Optimized tokens: ${stats.totalOptimizedTokens.toLocaleString()}`
    );
    console.log(
      `   Tokens saved: ${stats.totalSaved.toLocaleString()} (${stats.percentageSaved}%)`
    );
    console.log(
      `   💰 Estimated cost savings: $${stats.estimatedCostSavings.toFixed(4)}`
    );
  }
}

// Export singleton instance
export const toonStats = new TOONStats();

/**
 * Enable periodic stats reporting (useful for production monitoring)
 */
export function enablePeriodicReporting(intervalMinutes = 60) {
  setInterval(() => {
    toonStats.printStats();
  }, intervalMinutes * 60 * 1000);
}
