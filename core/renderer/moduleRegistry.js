/**
 * moduleRegistry.js — static import map for all known module renderers.
 *
 * This is the single file that changes when a new module is added to the platform.
 * Core's App.jsx reads the active module list from IPC config and looks each ID
 * up here to get its navItems and routes.
 *
 * To add a module:
 *   1. Import its renderer/index.js below
 *   2. Add its ID → import mapping to MODULE_REGISTRY
 *   3. Run `npm run build`
 */

import * as webManager from '../../modules/web_manager/renderer/index.js';

// Phase 3+: import * as solQuoter from '../../modules/sol_quoter/renderer/index.js';
// Phase 5+: import * as productDb  from '../../modules/product_db/renderer/index.js';

export const MODULE_REGISTRY = {
  'web-manager': webManager,
  // 'sol-quoter':  solQuoter,
  // 'product-db':  productDb,
};
