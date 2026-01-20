import { Server as SocketIOServer } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import { Server as HTTPServer } from "http";
import jwt from "jsonwebtoken";
import {
  RealtimeEventsPluginOptions,
  AuthenticatedSocket,
  RealtimeEventPayload,
} from "./types";
import type { Payload } from "payload";

/**
 * Socket.IO Manager for handling real-time events with Redis adapter
 * Supports multiple Payload instances for production environments
 */
export class SocketIOManager {
  private io: SocketIOServer | null = null;
  private pubClient: Redis | null = null;
  private subClient: Redis | null = null;
  private options: RealtimeEventsPluginOptions;
  private payload: Payload | null = null;

  constructor(options: RealtimeEventsPluginOptions) {
    this.options = options;
  }

  /**
   * Initialize Socket.IO server with Redis adapter
   */
  async init(
    server: HTTPServer,
    payloadInstance: Payload,
  ): Promise<SocketIOServer> {
    this.payload = payloadInstance;
    const { redis, socketIO = {} } = this.options;

    // Create Socket.IO server
    this.io = new SocketIOServer(server, {
      path: socketIO.path || "/socket.io",
      cors: socketIO.cors || {
        origin: "*",
        credentials: true,
      },
      ...socketIO,
    });

    // Setup Redis adapter
    if (redis) {
      await this.setupRedisAdapter();
    }

    // Setup authentication middleware
    this.setupAuthentication();

    // Setup connection handlers
    this.setupConnectionHandlers();

    this.payload!.logger.info(
      "Socket.IO server initialized with real-time events plugin",
    );

    return this.io;
  }

  /**
   * Setup Redis adapter for multi-instance synchronization
   */
  private async setupRedisAdapter(): Promise<void> {
    const redisUrl = this.options.redis?.url;

    if (!redisUrl) {
      this.payload!.logger.warn(
        "Redis URL not configured. Skipping Redis adapter setup. Set redis.url in plugin options.",
      );
      return;
    }

    try {
      this.pubClient = new Redis(redisUrl, {
        keyPrefix: "socket.io:",
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
      });

      this.subClient = this.pubClient.duplicate();

      await Promise.all([
        new Promise((resolve) => this.pubClient!.once("ready", resolve)),
        new Promise((resolve) => this.subClient!.once("ready", resolve)),
      ]);

      this.io!.adapter(createAdapter(this.pubClient, this.subClient));

      this.payload!.logger.info(
        "Redis adapter configured for Socket.IO multi-instance support",
      );
    } catch (error) {
      this.payload!.logger.error("Failed to setup Redis adapter:", error);
      throw error;
    }
  }

  /**
   * Setup authentication middleware for Socket.IO connections
   */
  /**
   * Setup Socket.IO authentication middleware
   * Verifies JWT tokens sent from clients (e.g., next-app via socket.handshake.auth.token)
   * Uses Payload CMS JWT verification and fetches user from database
   */
  private setupAuthentication(): void {
    this.io!.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token;

        if (!token) {
          return next(new Error("Authentication token required"));
        }
        try {
          const decoded = jwt.verify(token, this.payload!.secret) as any;

          // Fetch full user document from Payload
          const userDoc = await this.payload!.findByID({
            collection: decoded.collection || "users",
            id: decoded.id,
          });

          if (!userDoc) {
            return next(new Error("User not found"));
          }

          const userInfo = {
            id: userDoc.id,
            email: (userDoc as any).email,
            collection: decoded.collection || "users",
            role: (userDoc as any).role,
          };

          // Store in socket.data for Redis adapter compatibility
          // socket.data is automatically synchronized across servers via Redis
          socket.data.user = userInfo;

          // Also attach to socket.user for backward compatibility
          socket.user = userInfo;

          next();
        } catch (jwtError) {
          return next(new Error("Invalid authentication token"));
        }
      } catch (error) {
        this.payload!.logger.error("Socket authentication error:", error);
        next(new Error("Authentication failed"));
      }
    });
  }

  /**
   * Setup connection event handlers
   */
  private setupConnectionHandlers(): void {
    this.io!.on("connection", async (socket: AuthenticatedSocket) => {
      this.payload!.logger.info(
        `Client connected: ${socket.id}, User: ${
          socket.user?.email || socket.user?.id
        }`,
      );

      // Allow clients to subscribe to specific collections
      socket.on("subscribe", (collections: string | string[]) => {
        const collectionList = Array.isArray(collections)
          ? collections
          : [collections];
        collectionList.forEach((collection) => {
          socket.join(`collection:${collection}`);
          this.payload!.logger.info(
            `Client ${socket.id} subscribed to collection: ${collection}`,
          );
        });
      });

      // Allow clients to unsubscribe from collections
      socket.on("unsubscribe", (collections: string | string[]) => {
        const collectionList = Array.isArray(collections)
          ? collections
          : [collections];
        collectionList.forEach((collection) => {
          socket.leave(`collection:${collection}`);
          this.payload!.logger.info(
            `Client ${socket.id} unsubscribed from collection: ${collection}`,
          );
        });
      });

      // Allow clients to join collection rooms (alias for subscribe)
      socket.on("join-collection", (collection: string) => {
        const roomName = `collection:${collection}`;
        socket.join(roomName);
        this.payload!.logger.info(
          `Client ${socket.id} (${socket.user?.email}) joined collection room: ${roomName}`,
        );
      });

      // Handle disconnection
      socket.on("disconnect", () => {
        this.payload!.logger.info(
          `Client disconnected: ${socket.id}, User: ${
            socket.user?.email || socket.user?.id
          }`,
        );
      });

      if (this.options.onSocketConnection) {
        try {
          await this.options.onSocketConnection(
            socket,
            this.io!,
            this.payload!,
          );
        } catch (error) {
          this.payload!.logger.error(
            `Error in custom socket connection handler: ${error}`,
          );
        }
      }
    });
  }

  /**
   * Emit a real-time event to all connected clients
   */
  async emitEvent(event: RealtimeEventPayload): Promise<void> {
    if (!this.io) {
      this.payload!.logger.warn(
        "Socket.IO server not initialized, cannot emit event",
      );
      return;
    }

    const { authorize, shouldEmit, transformEvent } = this.options;

    // Check if event should be emitted
    if (shouldEmit && !shouldEmit(event)) {
      return;
    }

    // Transform event if transformer is provided
    const finalEvent = transformEvent ? transformEvent(event) : event;

    // Emit to collection-specific room
    const room = `collection:${event.collection}`;

    // If authorization is required, emit to each socket individually
    if (authorize) {
      // Get the handler for this collection
      const collectionHandler = authorize[event.collection];

      if (collectionHandler) {
        const sockets = await this.io.in(room).fetchSockets();
        for (const socket of sockets) {
          const authSocket = socket as unknown as AuthenticatedSocket;
          // Use socket.data.user for remote sockets (Redis adapter), fallback to socket.user for local
          const user = socket.data.user || authSocket.user;
          if (user) {
            const isAuthorized = await collectionHandler(user, finalEvent);
            if (isAuthorized) {
              socket.emit("payload:event", finalEvent);
            }
          }
        }
      }
      // If no handler for this collection, don't emit (deny by default)
    } else {
      // No authorization configured - emit to all sockets in the room
      this.io.to(room).emit("payload:event", finalEvent);
    }

    // Also emit to a global room for clients listening to all events
    this.io.emit("payload:event:all", finalEvent);
  }

  /**
   * Get Socket.IO server instance
   */
  getIO(): SocketIOServer | null {
    return this.io;
  }

  /**
   * Cleanup and close connections
   */
  async close(): Promise<void> {
    if (this.io) {
      this.io.close();
    }

    if (this.pubClient) {
      await this.pubClient.quit();
    }

    if (this.subClient) {
      await this.subClient.quit();
    }

    if (this.payload) {
      this.payload.logger.info("Socket.IO server closed");
    }
  }
}
