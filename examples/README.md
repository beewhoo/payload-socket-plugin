# Custom Event Handler Examples

This directory contains examples of how to implement custom socket event handlers for your specific use cases.

## Quick Reference

| Handler                | Events                                        | Use Case                                                |
| ---------------------- | --------------------------------------------- | ------------------------------------------------------- |
| `projectHandlers`      | `join-project`, `leave-project`, `kick-user`  | Multi-user project collaboration with presence tracking |
| `chatHandlers`         | `send-message`, `typing`, `mark-read`         | Real-time chat/messaging with typing indicators         |
| `notificationHandlers` | `send-notification`, `broadcast-announcement` | User notifications and system announcements             |

## Usage

### 1. Import Individual Handlers

```typescript
// payload.config.ts
import { socketPlugin } from "payload-socket-plugin";
import { projectHandlers } from "./examples/projectHandlers";

export default buildConfig({
  plugins: [
    socketPlugin({
      enabled: true,
      includeCollections: ["projects"],
      onSocketConnection: projectHandlers,
    }),
  ],
});
```

### 2. Import All Handlers from Index

```typescript
// payload.config.ts
import { socketPlugin } from "payload-socket-plugin";
import {
  projectHandlers,
  chatHandlers,
  notificationHandlers,
} from "./examples";

export default buildConfig({
  plugins: [
    socketPlugin({
      enabled: true,
      includeCollections: ["projects", "messages", "notifications"],
      onSocketConnection: (socket, io, payload) => {
        // Register all handlers
        projectHandlers(socket, io, payload);
        chatHandlers(socket, io, payload);
        notificationHandlers(socket, io, payload);
      },
    }),
  ],
});
```

### 3. Mix with Custom Inline Handlers

```typescript
import { projectHandlers } from "./examples/projectHandlers";

socketPlugin({
  onSocketConnection: (socket, io, payload) => {
    // Use pre-built handler
    projectHandlers(socket, io, payload);

    // Add your own custom handlers
    socket.on("custom-event", (data) => {
      // Your custom logic
    });
  },
});
```

## Examples Included

Each handler is in its own file for easy importing and customization:

### 📁 File Structure

```
examples/
├── index.ts                    # Export all handlers
├── projectHandlers.ts          # Project collaboration
├── chatHandlers.ts             # Chat/messaging
├── notificationHandlers.ts     # Notifications
└── README.md                   # This file
```

### 1. **Project Collaboration** (`projectHandlers.ts`)

Features for multi-user project collaboration:

- `join-project` - Join a project room with permission checking (owner or invited editors)
- `leave-project` - Leave a project room
- `kick-user` - Remove a user from a project (owner only)
- Presence tracking - Get list of active users in project
- Auto-cleanup on disconnect - Notify rooms when users disconnect

### 2. **Chat/Messaging** (`chatHandlers.ts`)

Real-time messaging features:

- `send-message` - Send messages to specific rooms (saved to database)
- `typing` - Typing indicators (who's typing in the room)
- `mark-read` - Mark messages as read with receipts

### 3. **Notifications** (`notificationHandlers.ts`)

User notification system:

- `send-notification` - Send notifications to specific users
- `broadcast-announcement` - Broadcast announcements to all users (admin only)
- Auto-join user notification rooms on connection

## Creating Your Own Handlers

```typescript
import type { AuthenticatedSocket } from "payload-socket-plugin";
import type { Server as SocketIOServer } from "socket.io";
import type { Payload } from "payload";

export const myCustomHandlers = (
  socket: AuthenticatedSocket,
  io: SocketIOServer,
  payload: Payload
) => {
  // Your custom event handlers
  socket.on("my-event", async (data) => {
    // Access authenticated user
    const userId = socket.user!.id;

    // Access Payload CMS
    const user = await payload.findByID({
      collection: "users",
      id: userId as string,
    });

    // Emit to specific rooms
    io.to(`room:${data.roomId}`).emit("response", {
      user,
      data,
    });
  });
};
```

## Best Practices

1. **Always validate input** - Check that required data is provided
2. **Handle errors gracefully** - Use try/catch and emit error events
3. **Check permissions** - Verify user has access before performing actions
4. **Use rooms effectively** - Organize users into rooms for targeted broadcasting
5. **Log important events** - Use `payload.logger` for debugging
6. **Clean up on disconnect** - Remove users from rooms when they disconnect

## Client-Side Usage

### Project Collaboration

```typescript
import { io } from "socket.io-client";

const socket = io("http://localhost:3000", {
  auth: { token: "your-jwt-token" },
});

// Join a project
socket.emit("join-project", "project-id-123");

// Listen for active users
socket.on("project:active-users", (users) => {
  console.log("Active users:", users);
  // [{ id: "1", email: "user@example.com" }, ...]
});

// Listen for user joined
socket.on("project:user-joined", (user) => {
  console.log("User joined:", user);
  // { id: "2", email: "another@example.com" }
});

// Listen for user left
socket.on("project:user-left", (userId) => {
  console.log("User left:", userId);
});

// Leave a project
socket.emit("leave-project", "project-id-123");

// Kick a user (owner only)
socket.emit("kick-user", {
  projectId: "project-id-123",
  userId: "user-id-456",
});

// Listen for kick events
socket.on("kicked-from-project", (data) => {
  console.log("You were kicked:", data.message);
  // Redirect user or show message
});
```

### Chat/Messaging

```typescript
// Send a message
socket.emit("send-message", {
  roomId: "room-123",
  message: "Hello everyone!",
});

// Listen for new messages
socket.on("new-message", (data) => {
  console.log("New message:", data);
  // {
  //   id: "msg-1",
  //   user: { id: "1", email: "user@example.com" },
  //   message: "Hello everyone!",
  //   timestamp: "2024-01-01T00:00:00.000Z"
  // }
});

// Show typing indicator
socket.emit("typing", {
  roomId: "room-123",
  isTyping: true,
});

// Listen for typing indicators
socket.on("user-typing", (data) => {
  console.log(`${data.email} is typing...`);
});

// Mark message as read
socket.emit("mark-read", {
  messageId: "msg-1",
});

// Listen for read receipts
socket.on("message-read", (data) => {
  console.log(`Message ${data.messageId} read by ${data.readBy}`);
});
```

### Notifications

```typescript
// Send notification to a user
socket.emit("send-notification", {
  userId: "user-123",
  message: "You have a new comment",
  type: "comment",
});

// Listen for notifications
socket.on("new-notification", (data) => {
  console.log("New notification:", data);
  // {
  //   id: "notif-1",
  //   message: "You have a new comment",
  //   type: "comment",
  //   timestamp: "2024-01-01T00:00:00.000Z"
  // }

  // Show toast notification
  showToast(data.message);
});

// Broadcast announcement (admin only)
socket.emit("broadcast-announcement", {
  message: "Server maintenance in 10 minutes",
  type: "warning",
});

// Listen for announcements
socket.on("announcement", (data) => {
  console.log("Announcement:", data);
  // {
  //   message: "Server maintenance in 10 minutes",
  //   type: "warning",
  //   from: "admin@example.com",
  //   timestamp: "2024-01-01T00:00:00.000Z"
  // }

  // Show banner or modal
  showAnnouncement(data);
});
```

### Combining Multiple Handlers

```typescript
// payload.config.ts
import { socketPlugin } from "payload-socket-plugin";
import {
  projectHandlers,
  chatHandlers,
  notificationHandlers,
} from "./examples/customHandlers";

export default buildConfig({
  plugins: [
    socketPlugin({
      enabled: true,
      includeCollections: ["projects", "messages", "notifications"],
      onSocketConnection: (socket, io, payload) => {
        // Register all handlers
        projectHandlers(socket, io, payload);
        chatHandlers(socket, io, payload);
        notificationHandlers(socket, io, payload);

        // Add custom inline handlers
        socket.on("custom-event", (data) => {
          // Your custom logic
        });
      },
    }),
  ],
});
```
