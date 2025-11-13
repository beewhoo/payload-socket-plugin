/**
 * Mock module for socket plugin
 * Used by webpack to prevent bundling server-side Socket.IO code in the admin panel
 *
 * This is aliased in payload.config.ts webpack configuration:
 * [socketPluginPath]: socketPluginMockPath
 */

import { Config } from "payload/config";

/**
 * Mock plugin that does nothing
 * The real plugin is only used on the server side
 */
export const socketPlugin =
  () =>
  (config: Config): Config => {
    // Return config unchanged - no Socket.IO in admin panel
    return config;
  };

