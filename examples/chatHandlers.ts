/**
 * Chat/Messaging Handlers
 *
 * Features:
 * - Send messages to specific rooms
 * - Typing indicators
 * - Message read receipts
 */

import type { AuthenticatedSocket } from "../src/types";
import type { Server as SocketIOServer } from "socket.io";
import type { Payload } from "payload";

export const chatHandlers = (
  socket: AuthenticatedSocket,
  io: SocketIOServer,
  payload: Payload
) => {
  // Send a message to a room
  socket.on(
    "send-message",
    async (data: { roomId: string; message: string }) => {
      const { roomId, message } = data;

      if (!roomId || !message) {
        socket.emit("error", { message: "Room ID and message are required" });
        return;
      }

      try {
        // Save message to database
        const newMessage = await payload.create({
          collection: "messages",
          data: {
            room: roomId,
            user: socket.user!.id,
            message,
            timestamp: new Date().toISOString(),
          },
        });

        // Broadcast to room
        io.to(`room:${roomId}`).emit("new-message", {
          id: newMessage.id,
          user: {
            id: socket.user!.id,
            email: socket.user!.email,
          },
          message,
          timestamp: newMessage.timestamp,
        });

        payload.logger.info(
          `User ${socket.user!.email} sent message to room ${roomId}`
        );
      } catch (error) {
        payload.logger.error("Error sending message:", error);
        socket.emit("send-message-error", {
          message: "Failed to send message",
        });
      }
    }
  );

  // Typing indicator
  socket.on("typing", (data: { roomId: string; isTyping: boolean }) => {
    const { roomId, isTyping } = data;

    if (!roomId) return;

    socket.to(`room:${roomId}`).emit("user-typing", {
      userId: socket.user!.id,
      email: socket.user!.email,
      isTyping,
    });
  });

  // Mark message as read
  socket.on("mark-read", async (data: { messageId: string }) => {
    const { messageId } = data;

    if (!messageId) return;

    try {
      await payload.update({
        collection: "messages",
        id: messageId,
        data: {
          readBy: socket.user!.id,
        },
      });

      // Notify sender that message was read
      socket.broadcast.emit("message-read", {
        messageId,
        readBy: socket.user!.id,
      });
    } catch (error) {
      payload.logger.error("Error marking message as read:", error);
    }
  });
};

