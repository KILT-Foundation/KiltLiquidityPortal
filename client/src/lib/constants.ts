export const BASE_NETWORK_ID = 8453;
// Real KILT token data from BaseScan
export const KILT_TOTAL_SUPPLY = 290560000;
export const TREASURY_PERCENTAGE = 0.01;
export const TREASURY_TOTAL = KILT_TOTAL_SUPPLY * TREASURY_PERCENTAGE;

// Note: Token addresses and pool addresses are now managed via admin panel
// Legacy constants kept for backward compatibility but should be replaced with API calls

// REMOVED: BASE_APR constant - all APR values now come from unified service API
export const MAX_TIME_MULTIPLIER = 2.0;
export const MAX_SIZE_MULTIPLIER = 1.5;
export const TIME_MULTIPLIER_DAYS = 30;
export const SIZE_MULTIPLIER_THRESHOLD = 100000;
