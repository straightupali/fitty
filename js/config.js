// Build flags. The beta copy lives at /fitty/beta/ on the same site as the main app,
// so it uses its own database and keys — testing it can never change your real data.
export const BETA = false;
export const DB_NAME = BETA ? 'fitty-beta' : 'fitbud'; // 'fitbud' = internal name kept from before the rename
export const MAIN_DB_NAME = 'fitbud';
export const BETA_DB_NAME = 'fitty-beta'; // where the v2.7 beta kept its test data
export const LS_PREFIX = BETA ? 'fittybeta:' : 'fitbud:';
