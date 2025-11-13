import { Server as HTTPServer } from "http";
import { SocketIOManager } from "./socketManager";
import payload from "payload";

/**
 * Initialize Socket.IO server with the HTTP server instance
 * This should be called after the HTTP server is created
 *
 * @example
 * ```ts
 * import { initSocketIO } from 'payload-socket-plugin';
 *
 * const server = app.listen(PORT, () => {
 *   console.log(`Server is running on port ${PORT}`);
 * });
 *
 * // Initialize Socket.IO
 * await initSocketIO(server);
 * ```
 */
export async function initSocketIO(httpServer: HTTPServer): Promise<void> {
  try {
    // Get the socket manager from payload instance
    const socketManager = (payload as any).__socketManager as SocketIOManager;

    if (!socketManager) {
      payload.logger.warn(
        "Socket.IO manager not found. Make sure socketPlugin is configured."
      );
      return;
    }

    // Initialize Socket.IO with the HTTP server
    await socketManager.init(httpServer);

    payload.logger.info("Socket.IO initialized successfully");
  } catch (error) {
    payload.logger.error("Failed to initialize Socket.IO:", error);
    throw error;
  }
}

