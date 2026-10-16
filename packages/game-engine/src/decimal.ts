import Decimal from 'decimal.js';

// Configure high precision for exact rational statistical computations without float drift
Decimal.set({ precision: 60, rounding: Decimal.ROUND_HALF_UP });

export { Decimal };
