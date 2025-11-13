/**
 * Notification Handlers
 *
 * Features:
 * - Send notifications to specific users
 * - Broadcast announcements
 * - User-specific notification rooms
 */

import type { AuthenticatedSocket } from "../src/types";
import type { Server as SocketIOServer } from "socket.io";
import type { Payload } from "payload";

export const notificationHandlers = (
  socket: AuthenticatedSocket,
  io: SocketIOServer,
  payload: Payload
) => {
  // Join user's personal notification room
  const userRoom = `user:${socket.user!.id}:notifications`;
  socket.join(userRoom);

  payload.logger.info(
    `User ${socket.user!.email} joined notification room: ${userRoom}`
  );

  // Send notification to specific user
  socket.on(
    "send-notification",
    async (data: { userId: string; message: string; type: string }) => {
      const { userId, message, type } = data;

      if (!userId || !message) {
        socket.emit("error", { message: "User ID and message are required" });
        return;
      }

      try {
        // Save notification to database
        const notification = await payload.create({
          collection: "notifications",
          data: {
            user: userId,
            message,
            type,
            read: false,
            timestamp: new Date().toISOString(),
          },
        });

        // Send to user's notification room
        io.to(`user:${userId}:notifications`).emit("new-notification", {
          id: notification.id,
          message,
          type,
          timestamp: notification.timestamp,
        });

        payload.logger.info(
          `Notification sent to user ${userId} from ${socket.user!.email}`
        );
      } catch (error) {
        payload.logger.error("Error sending notification:", error);
        socket.emit("send-notification-error", {
          message: "Failed to send notification",
        });
      }
    }
  );

  // Broadcast announcement to all users
  socket.on(
    "broadcast-announcement",
    async (data: { message: string; type: string }) => {
      const { message, type } = data;

      if (!message) {
        socket.emit("error", { message: "Message is required" });
        return;
      }

      // Check if user has admin role
      if (socket.user!.role !== "admin") {
        socket.emit("error", {
          message: "Only admins can broadcast announcements",
        });
        return;
      }

      try {
        // Broadcast to all connected clients
        io.emit("announcement", {
          message,
          type,
          from: socket.user!.email,
          timestamp: new Date().toISOString(),
        });

        payload.logger.info(
          `Admin ${socket.user!.email} broadcast announcement: ${message}`
        );
      } catch (error) {
        payload.logger.error("Error broadcasting announcement:", error);
      }
    }
  );
};

