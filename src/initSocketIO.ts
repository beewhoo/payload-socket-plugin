import { Server as HTTPServer } from "http";
import { SocketIOManager } from "./socketManager";
import type { Payload } from "payload";

/**
 * Initialize Socket.IO server with the HTTP server instance
 * This should be called after the HTTP server is created
 *
 * @example
 * ```ts
 * import { initSocketIO } from 'payload-socket-plugin';
 * import { getPayload } from 'payload';
 * import config from '@payload-config';
 *
 * const payload = await getPayload({ config });
 *
 * const server = app.listen(PORT, () => {
 *   console.log(`Server is running on port ${PORT}`);
 * });
 *
 * // Initialize Socket.IO
 * await initSocketIO(server, payload);
 * ```
 */
export async function initSocketIO(
  httpServer: HTTPServer,
  payloadInstance: Payload,
): Promise<void> {
  try {
    // Get the socket manager from payload instance
    const socketManager = (payloadInstance as any)
      .__socketManager as SocketIOManager;

    if (!socketManager) {
      payloadInstance.logger.warn(
        "Socket.IO manager not found. Make sure socketPlugin is configured.",
      );
      return;
    }

    // Initialize Socket.IO with the HTTP server
    await socketManager.init(httpServer, payloadInstance);

    payloadInstance.logger.info("Socket.IO initialized successfully");
  } catch (error) {
    payloadInstance.logger.error("Failed to initialize Socket.IO:", error);
    throw error;
  }
}
