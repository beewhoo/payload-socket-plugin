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
import payload from "payload";

/**
 * Socket.IO Manager for handling real-time events with Redis adapter
 * Supports multiple Payload instances for production environments
 */
export class SocketIOManager {
  private io: SocketIOServer | null = null;
  private pubClient: Redis | null = null;
  private subClient: Redis | null = null;
  private options: RealtimeEventsPluginOptions;

  constructor(options: RealtimeEventsPluginOptions) {
    this.options = options;
  }

  /**
   * Initialize Socket.IO server with Redis adapter
   */
  async init(server: HTTPServer): Promise<SocketIOServer> {
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

    payload.logger.info(
      "Socket.IO server initialized with real-time events plugin"
    );

    return this.io;
  }

  /**
   * Setup Redis adapter for multi-instance synchronization
   */
  private async setupRedisAdapter(): Promise<void> {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      payload.logger.warn(
        "REDIS_URL not configured. Skipping Redis adapter setup."
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

      payload.logger.info(
        "Redis adapter configured for Socket.IO multi-instance support"
      );
    } catch (error) {
      payload.logger.error("Failed to setup Redis adapter:", error);
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
          const decoded = jwt.verify(token, payload.secret) as any;

          // Fetch full user document from Payload
          const userDoc = await payload.findByID({
            collection: decoded.collection || "users",
            id: decoded.id,
          });

          if (!userDoc) {
            return next(new Error("User not found"));
          }

          // Attach user info
          socket.user = {
            id: userDoc.id,
            email: (userDoc as any).email,
            collection: decoded.collection || "users",
            role: (userDoc as any).role,
          };

          next();
        } catch (jwtError) {
          return next(new Error("Invalid authentication token"));
        }
      } catch (error) {
        payload.logger.error("Socket authentication error:", error);
        next(new Error("Authentication failed"));
      }
    });
  }

  /**
   * Setup connection event handlers
   */
  private setupConnectionHandlers(): void {
    this.io!.on("connection", (socket: AuthenticatedSocket) => {
      payload.logger.info(
        `Client connected: ${socket.id}, User: ${
          socket.user?.email || socket.user?.id
        }`
      );

      // Allow clients to subscribe to specific collections
      socket.on("subscribe", (collections: string | string[]) => {
        const collectionList = Array.isArray(collections)
          ? collections
          : [collections];
        collectionList.forEach((collection) => {
          socket.join(`collection:${collection}`);
          payload.logger.info(
            `Client ${socket.id} subscribed to collection: ${collection}`
          );
        });
      });

      // // Allow clients to unsubscribe from collections
      socket.on("unsubscribe", (collections: string | string[]) => {
        const collectionList = Array.isArray(collections)
          ? collections
          : [collections];
        collectionList.forEach((collection) => {
          socket.leave(`collection:${collection}`);
          payload.logger.info(
            `Client ${socket.id} unsubscribed from collection: ${collection}`
          );
        });
      });

      // Allow clients to join collection rooms to receive update events
      socket.on("join-collection", (collection: string) => {
        const roomName = `collection:${collection}`;
        socket.join(roomName);
        payload.logger.info(
          `Client ${socket.id} (${socket.user?.email}) joined collection room: ${roomName}`
        );
      });

      // Project room handlers for presence tracking
      socket.on("join-project", async (projectId: string) => {
        if (!projectId) {
          payload.logger.warn(
            `Client ${socket.id} tried to join project without ID`
          );
          return;
        }

        // Check if user has permission to join this project
        try {
          const project = await payload.findByID({
            collection: "projects",
            id: projectId,
            depth: 0,
          });

          const projectOwnerId =
            typeof project.user === "string"
              ? project.user
              : (project.user as any)?.id;

          const isOwner = socket.user!.id === projectOwnerId;

          // Check if user has editor invitation
          const invitation = await payload.find({
            collection: "projectInvitations",
            depth: 0,
            where: {
              user: { equals: socket.user!.id },
              status: { equals: "accepted" },
              project: { equals: projectId },
              role: { equals: "editor" },
            },
            limit: 1,
          });

          const hasEditorInvite = invitation.docs.length > 0;

          // Only allow owner, users with editor invitation
          if (!isOwner && !hasEditorInvite) {
            payload.logger.warn(
              `Client ${socket.id} (${socket.user?.email}) denied access to project ${projectId} - no editor permission`
            );
            socket.emit("join-project-error", {
              message: "You need editor access to join this project room",
            });
            return;
          }
        } catch (error) {
          payload.logger.error("Error checking project permissions:", error);
          socket.emit("join-project-error", {
            message: "Failed to verify project permissions",
          });
          return;
        }

        const roomName = `project:${projectId}:room`;
        await socket.join(roomName);

        payload.logger.info(
          `Client ${socket.id} (${
            socket.user?.email || socket.user?.id
          }) joined project: ${projectId}, room: ${roomName}`
        );

        // Debug: Log all rooms this socket is in
        payload.logger.info(
          `Socket ${socket.id} is now in rooms: ${Array.from(socket.rooms).join(
            ", "
          )}`
        );

        // Get all sockets in this project room
        const socketsInRoom = await this.io!.in(roomName).fetchSockets();

        // Build list of active users
        const activeUsers = socketsInRoom
          .map((s: any) => {
            if (s.user) {
              return {
                id: s.user.id,
                email: s.user.email || undefined,
              };
            }
            return null;
          })
          .filter((u) => u !== null);

        // Remove duplicates (same user, multiple tabs)
        const uniqueUsers = Array.from(
          new Map(activeUsers.map((u) => [u!.id, u])).values()
        );

        // Send current active users to the joining client
        socket.emit("project:active-users", uniqueUsers);

        // Notify others in the room that a new user joined
        socket.to(roomName).emit("project:user-joined", {
          id: socket.user!.id,
          email: socket.user!.email || undefined,
        });
      });

      socket.on("leave-project", (projectId: string) => {
        if (!projectId) return;

        const roomName = `project:${projectId}:room`;
        socket.leave(roomName);

        payload.logger.info(`Client ${socket.id} left project: ${projectId}`);

        // Notify others that user left
        socket.to(roomName).emit("project:user-left", socket.user!.id);
      });

      socket.on(
        "kick-user",
        async (data: { projectId: string; userId: string }) => {
          const { projectId, userId } = data;

          if (!projectId || !userId) {
            payload.logger.warn(
              `Client ${socket.id} tried to kick user without projectId or userId`
            );
            return;
          }

          // Verify the kicker is the project owner
          try {
            const project = await payload.findByID({
              collection: "projects",
              id: projectId,
            });

            const projectOwnerId =
              typeof project.user === "string"
                ? project.user
                : (project.user as any)?.id;

            if (socket.user!.id !== projectOwnerId) {
              payload.logger.warn(
                `Client ${socket.id} (${socket.user?.email}) tried to kick user but is not the owner`
              );
              socket.emit("kick-error", {
                message: "Only the project owner can kick users",
              });
              return;
            }

            // Find all sockets for the user to kick
            const roomName = `project:${projectId}:room`;
            const socketsInRoom = await this.io!.in(roomName).fetchSockets();

            let kicked = false;
            for (const s of socketsInRoom) {
              const socketUser = (s as any).user;
              if (socketUser && socketUser.id === userId) {
                // Emit kick event to the user being kicked
                s.emit("kicked-from-project", {
                  projectId,
                  message:
                    "You have been removed from this project by the owner",
                });

                // Remove them from the room
                s.leave(roomName);
                kicked = true;

                payload.logger.info(
                  `User ${userId} (${socketUser.email}) was kicked from project ${projectId} by ${socket.user?.email}`
                );
              }
            }

            if (kicked) {
              // Notify others that user was kicked
              socket.to(roomName).emit("project:user-left", userId);

              // Confirm to the kicker
              socket.emit("kick-success", { userId });
            } else {
              socket.emit("kick-error", {
                message: "User not found in project",
              });
            }
          } catch (error) {
            payload.logger.error("Error kicking user:", error);
            socket.emit("kick-error", {
              message: "Failed to kick user",
            });
          }
        }
      );

      // Handle disconnection - clean up project presence
      socket.on("disconnect", async () => {
        payload.logger.info(
          `Client disconnected: ${socket.id}, User: ${
            socket.user?.email || socket.user?.id
          }`
        );

        // Notify all project rooms that this user left
        // Socket.IO automatically tracks which rooms the socket was in
        const rooms = Array.from(socket.rooms);

        for (const room of rooms) {
          // Only process project rooms (skip the socket's own room)
          if (room.startsWith("project:") && socket.user) {
            socket.to(room).emit("project:user-left", socket.user.id);
            payload.logger.info(
              `Notified room ${room} that user ${socket.user.id} left`
            );
          }
        }
      });
    });
  }

  /**
   * Emit a real-time event to all connected clients
   */
  async emitEvent(event: RealtimeEventPayload): Promise<void> {
    if (!this.io) {
      payload.logger.warn(
        "Socket.IO server not initialized, cannot emit event"
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
          if (authSocket.user) {
            const isAuthorized = await collectionHandler(
              authSocket.user,
              finalEvent
            );
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

    payload.logger.info("Socket.IO server closed");
  }
}
