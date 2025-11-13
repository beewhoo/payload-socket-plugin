/**
 * Project Collaboration Handlers
 *
 * Features:
 * - Join/leave project rooms with permission checking
 * - Active user tracking (who's currently in the project)
 * - User kick functionality (owner only)
 * - Automatic cleanup on disconnect
 */

import type { AuthenticatedSocket } from "../src/types";
import type { Server as SocketIOServer } from "socket.io";
import type { Payload } from "payload";

export const projectHandlers = (
  socket: AuthenticatedSocket,
  io: SocketIOServer,
  payload: Payload
) => {
  // Join a project room with permission checking
  socket.on("join-project", async (projectId: string) => {
    if (!projectId) {
      socket.emit("error", { message: "Project ID is required" });
      return;
    }

    try {
      // Check if user has permission to join this project
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

      // Check for editor invitation
      const invitation = await payload.find({
        collection: "projectInvitations",
        where: {
          user: { equals: socket.user!.id },
          status: { equals: "accepted" },
          project: { equals: projectId },
          role: { equals: "editor" },
        },
        limit: 1,
      });

      const hasEditorInvite = invitation.docs.length > 0;

      if (!isOwner && !hasEditorInvite) {
        socket.emit("join-project-error", {
          message: "You don't have permission to join this project",
        });
        return;
      }

      // Join the room
      const roomName = `project:${projectId}`;
      await socket.join(roomName);

      // Get active users in the room
      const socketsInRoom = await io.in(roomName).fetchSockets();
      const activeUsers = socketsInRoom
        .map((s: any) => ({
          id: s.user?.id,
          email: s.user?.email,
        }))
        .filter((u) => u.id);

      // Send active users to the joining client
      socket.emit("project:active-users", activeUsers);

      // Notify others that a new user joined
      socket.to(roomName).emit("project:user-joined", {
        id: socket.user!.id,
        email: socket.user!.email,
      });

      payload.logger.info(
        `User ${socket.user!.email} joined project ${projectId}`
      );
    } catch (error) {
      payload.logger.error("Error joining project:", error);
      socket.emit("join-project-error", {
        message: "Failed to join project",
      });
    }
  });

  // Leave a project room
  socket.on("leave-project", (projectId: string) => {
    if (!projectId) return;

    const roomName = `project:${projectId}`;
    socket.leave(roomName);

    // Notify others that user left
    socket.to(roomName).emit("project:user-left", socket.user!.id);

    payload.logger.info(`User ${socket.user!.email} left project ${projectId}`);
  });

  // Kick a user from a project (owner only)
  socket.on(
    "kick-user",
    async (data: { projectId: string; userId: string }) => {
      const { projectId, userId } = data;

      if (!projectId || !userId) {
        socket.emit("error", {
          message: "Project ID and User ID are required",
        });
        return;
      }

      try {
        // Verify the kicker is the project owner
        const project = await payload.findByID({
          collection: "projects",
          id: projectId,
        });

        const projectOwnerId =
          typeof project.user === "string"
            ? project.user
            : (project.user as any)?.id;

        if (socket.user!.id !== projectOwnerId) {
          socket.emit("kick-error", {
            message: "Only the project owner can kick users",
          });
          return;
        }

        // Find and kick the user's sockets
        const roomName = `project:${projectId}`;
        const socketsInRoom = await io.in(roomName).fetchSockets();

        let kicked = false;
        for (const s of socketsInRoom) {
          const socketUser = (s as any).user;
          if (socketUser?.id === userId) {
            s.emit("kicked-from-project", {
              projectId,
              message: "You have been removed from this project",
            });
            s.leave(roomName);
            kicked = true;
          }
        }

        if (kicked) {
          socket.to(roomName).emit("project:user-left", userId);
          socket.emit("kick-success", { userId });
        }
      } catch (error) {
        payload.logger.error("Error kicking user:", error);
        socket.emit("kick-error", { message: "Failed to kick user" });
      }
    }
  );

  // Handle disconnection - clean up project presence
  socket.on("disconnect", () => {
    payload.logger.info(
      `Client disconnected: ${socket.id}, User: ${
        socket.user?.email || socket.user?.id
      }`
    );

    // Notify all project rooms that this user left
    const rooms = Array.from(socket.rooms);

    for (const room of rooms) {
      if (
        typeof room === "string" &&
        room.startsWith("project:") &&
        socket.user
      ) {
        socket.to(room).emit("project:user-left", socket.user.id);
        payload.logger.info(
          `Notified room ${room} that user ${socket.user.id} left`
        );
      }
    }
  });
};
