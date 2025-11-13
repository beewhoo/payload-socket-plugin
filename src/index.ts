import { Config, Plugin } from "payload/config";
import { CollectionConfig } from "payload/types";
import { SocketIOManager } from "./socketManager";
import {
  RealtimeEventsPluginOptions,
  RealtimeEventPayload,
  EventType,
} from "./types";

/**
 * Payload CMS Plugin for Real-time Events
 *
 * This plugin enables real-time event broadcasting for collection changes
 * using Socket.IO with Redis adapter for multi-instance support.
 *
 * @example
 * ```ts
 * import { socketPlugin } from 'payload-socket-plugin';
 *
 * export default buildConfig({
 *   plugins: [
 *     socketPlugin({
 *       enabled: true,
 *       redis: {
 *         url: process.env.REDIS_URL,
 *       },
 *       socketIO: {
 *         cors: {
 *           origin: ['http://localhost:3000'],
 *           credentials: true,
 *         },
 *       },
 *       includeCollections: ['projects', 'actors'],
 *       authorize: {
 *         projects: async (user, event) => {
 *           // Your authorization logic
 *           return user.id === event.doc.user;
 *         }
 *       }
 *     }),
 *   ],
 * });
 * ```
 */
export const socketPlugin = (
  pluginOptions: RealtimeEventsPluginOptions = {}
): Plugin => {
  return (incomingConfig: Config): Config => {
    // Default options
    const options: RealtimeEventsPluginOptions = {
      enabled: true,
      includeCollections: [],
      ...pluginOptions,
    };

    // If plugin is disabled, return config unchanged
    if (options.enabled === false) {
      return incomingConfig;
    }

    const socketManager = new SocketIOManager(options);

    /**
     * Helper function to check if events should be emitted for a collection
     */
    const shouldEmitForCollection = (collectionSlug: string): boolean => {
      // Only emit for collections explicitly included
      if (options.includeCollections && options.includeCollections.length > 0) {
        return options.includeCollections.includes(collectionSlug);
      }

      // If no collections specified, don't emit for any
      return false;
    };

    /**
     * Create event payload from hook arguments
     */
    const createEventPayload = (
      type: EventType,
      collection: string,
      args: any
    ): RealtimeEventPayload => {
      return {
        type,
        collection,
        id: args.doc?.id || args.id,
        doc: type === "delete" ? undefined : args.doc,
        user: args.req?.user
          ? {
              id: args.req.user.id,
              email: args.req.user.email,
              collection: args.req.user.collection,
            }
          : undefined,
        timestamp: new Date().toISOString(),
      };
    };

    /**
     * Add hooks to collections
     */
    const collectionsWithHooks: CollectionConfig[] =
      incomingConfig.collections?.map((collection) => {
        // Skip if events should not be emitted for this collection
        if (!shouldEmitForCollection(collection.slug)) {
          return collection;
        }

        return {
          ...collection,
          hooks: {
            ...collection.hooks,
            // After change hook - only emit for updates
            afterChange: [
              ...(collection.hooks?.afterChange || []),
              async (args) => {
                try {
                  // Only emit events for updates, not creates
                  if (args.operation !== "update") {
                    return;
                  }

                  const event = createEventPayload(
                    "update",
                    collection.slug,
                    args
                  );

                  await socketManager.emitEvent(event);
                } catch (error) {
                  console.error(
                    `Error emitting update event for ${collection.slug}:`,
                    error
                  );
                }
              },
            ],
            // After delete hook
            afterDelete: [
              ...(collection.hooks?.afterDelete || []),
              async (args) => {
                try {
                  const event = createEventPayload(
                    "delete",
                    collection.slug,
                    args
                  );

                  await socketManager.emitEvent(event);
                } catch (error) {
                  console.error(
                    `Error emitting delete event for ${collection.slug}:`,
                    error
                  );
                }
              },
            ],
          },
        };
      }) || [];

    /**
     * Add onInit hook to initialize Socket.IO server
     */
    const onInit = async (payload: any) => {
      // Call original onInit if it exists
      if (incomingConfig.onInit) {
        await incomingConfig.onInit(payload);
      }

      // Initialize Socket.IO server
      // The server instance is available after Payload initializes with Express
      if (payload.express) {
        // Store the socket manager for later initialization
        // The HTTP server will be initialized in server.ts using initSocketIO()
        (payload as any).__socketManager = socketManager;
      }
    };

    return {
      ...incomingConfig,
      collections: collectionsWithHooks,
      onInit,
    };
  };
};

// Export types for external use
export * from "./types";
export { SocketIOManager } from "./socketManager";
export { initSocketIO } from "./initSocketIO";
