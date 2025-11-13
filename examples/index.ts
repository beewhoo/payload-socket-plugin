/**
 * Custom Socket Event Handlers
 * 
 * Export all custom handler implementations for easy importing.
 * 
 * Usage:
 * ```typescript
 * import { projectHandlers, chatHandlers, notificationHandlers } from './examples';
 * 
 * socketPlugin({
 *   onSocketConnection: (socket, io, payload) => {
 *     projectHandlers(socket, io, payload);
 *     chatHandlers(socket, io, payload);
 *     notificationHandlers(socket, io, payload);
 *   }
 * });
 * ```
 */

export { projectHandlers } from "./projectHandlers";
export { chatHandlers } from "./chatHandlers";
export { notificationHandlers } from "./notificationHandlers";

