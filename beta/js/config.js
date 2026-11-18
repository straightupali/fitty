// Build flags. The beta copy lives at /fitty/beta/ on the same site as the main app,
// so it uses its own database and keys — testing it can never change your real data.
export const BETA = true;
export const DB_NAME = BETA ? 'fitty-beta' : 'fitbud'; // 'fitbud' = internal name kept from before the rename
export const MAIN_DB_NAME = 'fitbud';
export const LS_PREFIX = BETA ? 'fittybeta:' : 'fitbud:';
