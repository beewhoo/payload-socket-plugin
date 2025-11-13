import { Socket } from "socket.io";

/**
 * Event types that can be emitted
 */
export type EventType = "create" | "update" | "delete";

/**
 * Payload for real-time events
 */
export interface RealtimeEventPayload {
  /** Type of event */
  type: EventType;
  /** Collection slug */
  collection: string;
  /** Document ID */
  id: string | number;
  /** Document data (for create/update events) */
  doc?: any;
  /** User who triggered the event */
  user?: {
    id: string | number;
    email?: string;
    collection?: string;
  };
  /** Timestamp of the event */
  timestamp: string;
}

/**
 * Socket.IO server instance with authentication
 */
export interface AuthenticatedSocket extends Socket {
  user?: {
    id: string | number;
    email?: string;
    collection?: string;
    role?: string;
  };
}

/**
 * Authorization handler for a specific collection
 */
export type CollectionAuthorizationHandler = (
  user: any,
  event: RealtimeEventPayload
) => Promise<boolean>;

/**
 * Plugin configuration options
 */
export interface RealtimeEventsPluginOptions {
  /**
   * Enable/disable the plugin
   * @default true
   */
  enabled?: boolean;

  /**
   * Collections to include for real-time events
   * Only these collections will have real-time events enabled
   * If not provided or empty, no collections will have real-time events
   */
  includeCollections?: string[];

  /**
   * Redis configuration for multi-instance support
   * Uses REDIS_URL environment variable
   */
  redis?: {
    /** Redis connection URL - uses process.env.REDIS_URL */
    url?: string;
  };

  /**
   * Socket.IO server options
   */
  socketIO?: {
    /** CORS configuration */
    cors?: {
      origin?:
        | string
        | string[]
        | ((
            origin: string | undefined,
            callback: (err: Error | null, allow?: boolean) => void
          ) => void);
      credentials?: boolean;
    };
    /** Path for Socket.IO endpoint */
    path?: string;
    /** Additional Socket.IO server options */
    [key: string]: any;
  };

  /**
   * Custom authentication function
   * If not provided, uses Payload's built-in JWT authentication
   */
  authenticate?: (socket: Socket, payload: any) => Promise<any>;

  /**
   * Authorization handlers per collection
   * Map of collection slug to authorization handler function
   *
   * @example
   * ```ts
   * authorize: {
   *   projects: async (user, event) => {
   *     // Check if user can receive this project event
   *     return user.id === event.doc.user;
   *   },
   *   actors: async (user, event) => {
   *     // Check if user can receive this actor event
   *     return user.id === event.doc.user;
   *   }
   * }
   * ```
   */
  authorize?: {
    [collectionSlug: string]: CollectionAuthorizationHandler;
  };

  /**
   * Event filter function to determine if an event should be emitted
   */
  shouldEmit?: (event: RealtimeEventPayload) => boolean;

  /**
   * Custom event transformer
   */
  transformEvent?: (event: RealtimeEventPayload) => RealtimeEventPayload;
}
