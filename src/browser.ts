import type { Config } from "payload";

/**
 * Browser-safe mock for the Socket.IO plugin
 * This file is used when bundling for the browser (e.g., Payload admin panel)
 * The actual Socket.IO server only runs on the server side
 */
export const socketPlugin =
  () =>
  (config: Config): Config => {
    // Return config unchanged - Socket.IO server is server-side only
    return config;
  };

/**
 * Browser-safe mock for initSocketIO
 * Does nothing in browser environment
 */
export const initSocketIO = async (httpServer?: any): Promise<void> => {
  // No-op in browser
  console.warn("initSocketIO called in browser environment - this is a no-op");
};

/**
 * Browser-safe mock for SocketIOManager
 * Returns a minimal mock class in browser environment
 */
export class SocketIOManager {
  constructor() {
    // No-op in browser
  }
}
