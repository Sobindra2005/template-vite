/**
 * Standard Normal Probability Density Function (PDF)
 * @param {number} x
 * @returns {number}
 */
export function nd(x) {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

/**
 * Cumulative Standard Normal Distribution Function (CND)
 * Approximated using a high-precision polynomial.
 * @param {number} x
 * @returns {number}
 */
export function cnd(x) {
    const a1 = 0.31938153;
    const a2 = -0.356563782;
    const a3 = 1.781477937;
    const a4 = -1.821255978;
    const a5 = 1.330274429;
    
    const L = Math.abs(x);
    const K = 1.0 / (1.0 + 0.2316419 * L);
    let w = 1.0 - (1.0 / Math.sqrt(2.0 * Math.PI)) * Math.exp(-0.5 * L * L) * 
            (a1 * K + a2 * Math.pow(K, 2) + a3 * Math.pow(K, 3) + a4 * Math.pow(K, 4) + a5 * Math.pow(K, 5));
            
    return x < 0 ? 1.0 - w : w;
}

/**
 * Black-Scholes European Option Price
 * @param {'call'|'put'} type - Option type
 * @param {number} S - Current asset price
 * @param {number} K - Strike price
 * @param {number} T - Time to expiration in years (or scaled time units)
 * @param {number} r - Risk-free interest rate (annualized or scaled)
 * @param {number} sigma - Implied/historical volatility
 * @returns {number} Option price
 */
export function bsPrice(type, S, K, T, r, sigma) {
    if (T <= 0) {
        if (type === 'call') return Math.max(0, S - K);
        return Math.max(0, K - S);
    }
    
    const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
    const d2 = d1 - sigma * Math.sqrt(T);
    
    if (type === 'call') {
        return S * cnd(d1) - K * Math.exp(-r * T) * cnd(d2);
    } else {
        return K * Math.exp(-r * T) * cnd(-d2) - S * cnd(-d1);
    }
}

/**
 * Option Vega (derivative of price with respect to volatility)
 * @param {number} S - Current asset price
 * @param {number} K - Strike price
 * @param {number} T - Time to expiration in years
 * @param {number} r - Risk-free interest rate
 * @param {number} sigma - Volatility
 * @returns {number} Vega
 */
export function bsVega(S, K, T, r, sigma) {
    if (T <= 0) return 0;
    const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
    return S * Math.sqrt(T) * nd(d1);
}

/**
 * Calculates Implied Volatility using the Newton-Raphson Method.
 * Falls back to Bisection search if Newton-Raphson fails to converge or Vega gets too small.
 * @param {'call'|'put'} type - Option type
 * @param {number} marketPrice - Observed market option price
 * @param {number} S - Current asset price
 * @param {number} K - Strike price
 * @param {number} T - Time to expiration in years
 * @param {number} r - Risk-free interest rate
 * @returns {number} Implied Volatility
 */
export function getImpliedVolatility(type, marketPrice, S, K, T, r) {
    const maxIterations = 100;
    const tolerance = 1e-6;
    
    // Initial guess
    let sigma = 0.5;
    
    // 1. Try Newton-Raphson Method
    for (let i = 0; i < maxIterations; i++) {
        const price = bsPrice(type, S, K, T, r, sigma);
        const diff = price - marketPrice;
        
        if (Math.abs(diff) < tolerance) {
            return sigma;
        }
        
        const vega = bsVega(S, K, T, r, sigma);
        // Avoid division by zero/extremely small Vega
        if (vega < 1e-4) {
            break; 
        }
        
        sigma = sigma - diff / vega;
        
        // Keep sigma in sensible positive boundaries during iteration
        if (sigma <= 0.0001 || sigma > 10.0) {
            break;
        }
    }
    
    // 2. Fallback: Bisection Search (highly robust, guaranteed to converge if solution exists in bounds)
    let low = 0.0001;
    let high = 10.0;
    
    for (let i = 0; i < maxIterations; i++) {
        sigma = 0.5 * (low + high);
        const price = bsPrice(type, S, K, T, r, sigma);
        const diff = price - marketPrice;
        
        if (Math.abs(diff) < tolerance) {
            return sigma;
        }
        
        if (diff > 0) {
            high = sigma;
        } else {
            low = sigma;
        }
    }
    
    return sigma; // Return best estimate
}

/**
 * Calculates risk-neutral probability of asset price ending in range [K1, K2] at time T
 * @param {number} S0 - Current asset price
 * @param {number} K1 - Lower price boundary
 * @param {number} K2 - Upper price boundary (must be > K1)
 * @param {number} T - Time to expiration (in seconds/years)
 * @param {number} r - Risk-free interest rate
 * @param {number} sigma - Volatility parameter
 * @returns {number} Probability between 0 and 1
 */
export function getIntervalProbability(S0, K1, K2, T, r, sigma) {
    if (T <= 0) {
        return (S0 >= K1 && S0 <= K2) ? 1.0 : 0.0;
    }
    if (sigma <= 0) {
        const S_end = S0 * Math.exp(r * T);
        return (S_end >= K1 && S_end <= K2) ? 1.0 : 0.0;
    }
    
    // P(K1 <= S_T <= K2) = P(S_T > K1) - P(S_T > K2)
    // where P(S_T > K) = cnd(d2(K))
    const d2_K1 = (Math.log(S0 / K1) + (r - 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
    const d2_K2 = (Math.log(S0 / K2) + (r - 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
    
    return cnd(d2_K1) - cnd(d2_K2);
}

/**
 * Calculates the game payout multiplier for a given target cell range
 * @param {number} S0 - Current asset price
 * @param {number} K1 - Lower price boundary
 * @param {number} K2 - Upper price boundary
 * @param {number} T - Time to expiration
 * @param {number} r - Interest rate/drift
 * @param {number} sigma - Volatility parameter
 * @param {number} margin - House edge/fee (e.g., 0.1 for 10% fee)
 * @param {number} maxMultiplier - Maximum allowed multiplier cap
 * @returns {number} The payout multiplier (e.g., 1.5 for 1.5x)
 */
export function getMultiplier(S0, K1, K2, T, r, sigma, margin = 0.1, maxMultiplier = 100.0) {
    const prob = getIntervalProbability(S0, K1, K2, T, r, sigma);
    if (prob <= 0) return maxMultiplier;
    
    const fairMult = 1.0 / prob;
    const finalMult = fairMult * (1 - margin);
    
    return Math.min(Math.max(1.0, finalMult), maxMultiplier);
}

/**
 * Calculates interval probability under Bachelier model (Arithmetic Brownian Motion / Normal Distribution)
 * @param {number} S0 - Current asset price
 * @param {number} K1 - Lower price boundary
 * @param {number} K2 - Upper price boundary (must be > K1)
 * @param {number} T - Time to expiration in seconds/years
 * @param {number} drift - Absolute drift in dollars per second (usually 0.0)
 * @param {number} sigmaAbs - Absolute volatility in dollars per root-second
 * @returns {number} Probability between 0 and 1
 */
export function getBachelierProbability(S0, K1, K2, T, drift, sigmaAbs) {
    if (T <= 0) {
        return (S0 >= K1 && S0 <= K2) ? 1.0 : 0.0;
    }
    if (sigmaAbs <= 0) {
        const S_end = S0 + drift * T;
        return (S_end >= K1 && S_end <= K2) ? 1.0 : 0.0;
    }
    
    const stdDev = sigmaAbs * Math.sqrt(T);
    const mean = S0 + drift * T;
    
    // P(K1 <= S_T <= K2) under Normal Distribution
    const d1 = (K1 - mean) / stdDev;
    const d2 = (K2 - mean) / stdDev;
    
    return cnd(d2) - cnd(d1);
}

/**
 * Calculates payout multiplier under Bachelier model
 * @param {number} S0 - Current asset price
 * @param {number} K1 - Lower price boundary
 * @param {number} K2 - Upper price boundary
 * @param {number} T - Time to expiration
 * @param {number} drift - Absolute drift
 * @param {number} sigmaAbs - Absolute volatility
 * @param {number} margin - House edge/fee (e.g. 0.1 for 10%)
 * @param {number} maxMultiplier - Maximum allowed multiplier
 * @returns {number} The payout multiplier
 */
export function getBachelierMultiplier(S0, K1, K2, T, drift = 0.0, sigmaAbs, margin = 0.1, maxMultiplier = 100.0) {
    const prob = getBachelierProbability(S0, K1, K2, T, drift, sigmaAbs);
    if (prob <= 0) return maxMultiplier;
    
    const fairMult = 1.0 / prob;
    const finalMult = fairMult * (1 - margin);
    
    return Math.min(Math.max(1.0, finalMult), maxMultiplier);
}
