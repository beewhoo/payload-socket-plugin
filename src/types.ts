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
 * Events that the server can emit to clients
 */
export interface ServerToClientEvents {
  /** Real-time event for a specific collection */
  "payload:event": (event: RealtimeEventPayload) => void;
  /** Real-time event broadcast to all listeners */
  "payload:event:all": (event: RealtimeEventPayload) => void;
}

/**
 * Events that clients can send to the server
 */
export interface ClientToServerEvents {
  /** Subscribe to one or more collections */
  subscribe: (collections: string | string[]) => void;
  /** Unsubscribe from one or more collections */
  unsubscribe: (collections: string | string[]) => void;
  /** Join a collection room (alias for subscribe) */
  "join-collection": (collection: string) => void;
}

/**
 * Events for inter-server communication (when using Redis adapter)
 */
export interface InterServerEvents {
  ping: () => void;
}

/**
 * Data stored on each socket instance
 */
export interface SocketData {
  user?: {
    id: string | number;
    email?: string;
    collection?: string;
    role?: string;
  };
}

/**
 * Socket.IO server instance with authentication
 * @deprecated Use Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> instead
 */
export interface AuthenticatedSocket
  extends Socket<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  > {
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

  /**
   * Custom socket event handlers
   * Register your own event handlers that will be attached to each authenticated socket
   *
   * @example
   * ```ts
   * onSocketConnection: (socket, io, payload) => {
   *   socket.on('custom-event', (data) => {
   *     // Handle custom event
   *     socket.emit('custom-response', { success: true });
   *   });
   *
   *   socket.on('join-room', (roomId) => {
   *     socket.join(`custom:${roomId}`);
   *   });
   * }
   * ```
   */
  onSocketConnection?: (
    socket: AuthenticatedSocket,
    io: any,
    payload: any
  ) => void | Promise<void>;
}
