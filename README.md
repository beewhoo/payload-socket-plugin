# Payload Socket Plugin

[![npm version](https://badge.fury.io/js/payload-socket-plugin.svg)](https://www.npmjs.com/package/payload-socket-plugin)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/payload-socket-plugin.svg)](https://nodejs.org)

Real-time event broadcasting plugin for Payload CMS using Socket.IO with Redis support for multi-instance deployments.

## Features

- ✅ **Real-time Events**: Broadcast collection changes (create, update, delete) to connected clients
- ✅ **Redis Support**: Multi-instance synchronization using Redis adapter
- ✅ **Per-Collection Authorization**: Fine-grained control over who receives events
- ✅ **JWT Authentication**: Secure WebSocket connections using Payload's JWT tokens
- ✅ **TypeScript**: Full type safety with TypeScript definitions
- ✅ **Flexible Configuration**: Customize CORS, paths, and event handling

## Prerequisites

- **Node.js**: >= 20.0.0
- **Payload CMS**: ^2.0.0 || ^3.0.0
- **Redis** (optional): Required for multi-instance deployments

## Installation

```bash
npm install payload-socket-plugin
# or
yarn add payload-socket-plugin
# or
pnpm add payload-socket-plugin
```

### Install Socket.IO Client (for frontend)

```bash
npm install socket.io-client
```

## Quick Start

### 1. Configure the Plugin

```typescript
// payload.config.ts
import { buildConfig } from "payload/config";
import { socketPlugin } from "payload-socket-plugin";

export default buildConfig({
  // ... other config
  plugins: [
    socketPlugin({
      enabled: true,
      redis: {
        url: process.env.REDIS_URL,
      },
      socketIO: {
        cors: {
          origin: ["http://localhost:3000"],
          credentials: true,
        },
        path: "/socket.io",
      },
      includeCollections: ["posts", "users"],
      authorize: {
        posts: async (user, event) => {
          // Allow everyone to receive public post events
          return (
            event.doc.status === "published" || user.id === event.doc.author
          );
        },
        users: async (user, event) => {
          // Only allow user to receive their own events
          return user.id === event.id;
        },
      },
    }),
  ],
});
```

### 2. Initialize Socket.IO Server

```typescript
// server.ts
import express from "express";
import payload from "payload";
import { initSocketIO } from "payload-socket-plugin";

const app = express();

// Initialize Payload
await payload.init({
  secret: process.env.PAYLOAD_SECRET,
  express: app,
});

// Start HTTP server
const server = app.listen(3000, () => {
  console.log("Server running on port 3000");
});

// Initialize Socket.IO
await initSocketIO(server);
```

### 3. Connect from Client

```typescript
// client.ts
import { io } from "socket.io-client";

const socket = io("http://localhost:3000", {
  auth: {
    token: "your-jwt-token", // Get from Payload login
  },
});

// Subscribe to collection events
socket.emit("join-collection", "posts");

// Listen for events
socket.on("payload:event", (event) => {
  console.log("Event received:", event);
  // {
  //   type: 'update',
  //   collection: 'posts',
  //   id: '123',
  //   doc: { title: 'My Post', status: 'published', ... },
  //   user: { id: '456', email: 'user@example.com' },
  //   timestamp: '2024-01-01T00:00:00.000Z'
  // }
});
```

## Configuration Options

### `RealtimeEventsPluginOptions`

| Option               | Type       | Default | Description                                             |
| -------------------- | ---------- | ------- | ------------------------------------------------------- |
| `enabled`            | `boolean`  | `true`  | Enable/disable the plugin                               |
| `includeCollections` | `string[]` | `[]`    | Collections to enable real-time events for              |
| `redis`              | `object`   | -       | Redis configuration for multi-instance support          |
| `socketIO`           | `object`   | -       | Socket.IO server options (CORS, path, etc.)             |
| `authorize`          | `object`   | -       | Per-collection authorization handlers                   |
| `shouldEmit`         | `function` | -       | Filter function to determine if event should be emitted |
| `transformEvent`     | `function` | -       | Transform events before emitting                        |
| `onSocketConnection` | `function` | -       | Custom event handlers for each socket connection        |

## Authorization

Authorization handlers determine which users can receive events for specific documents.

```typescript
import type { CollectionAuthorizationHandler } from "payload-socket-plugin";

const authorizePost: CollectionAuthorizationHandler = async (user, event) => {
  // Admin can see all events
  if (user.role === "admin") {
    return true;
  }

  // Check if post is published or user is the author
  const post = await payload.findByID({
    collection: "posts",
    id: event.id as string,
  });

  return post.status === "published" || user.id === post.author;
};

// Use in plugin config
socketPlugin({
  authorize: {
    posts: authorizePost,
  },
});
```

## Client Events

### Subscribing to Collections

```typescript
// Subscribe to a single collection
socket.emit("join-collection", "posts");

// Subscribe to multiple collections
socket.emit("subscribe", ["posts", "users", "media"]);

// Unsubscribe
socket.emit("unsubscribe", ["posts"]);
```

### Listening for Events

```typescript
// Listen to specific collection events
socket.on("payload:event", (event) => {
  if (event.collection === "posts" && event.type === "update") {
    // Handle post update
  }
});

// Listen to all events
socket.on("payload:event:all", (event) => {
  console.log("Any event:", event);
});
```

## Advanced Usage

### Custom Socket Event Handlers

You can register your own custom event handlers that will be attached to each authenticated socket.

**Simple inline handlers:**

```typescript
socketPlugin({
  onSocketConnection: (socket, io, payload) => {
    // Custom event handler
    socket.on("send-message", async (data) => {
      const { roomId, message } = data;

      // Broadcast to room
      io.to(`room:${roomId}`).emit("new-message", {
        user: socket.user,
        message,
        timestamp: new Date().toISOString(),
      });
    });

    // Custom room management
    socket.on("join-custom-room", (roomId) => {
      socket.join(`room:${roomId}`);
      socket.emit("joined-room", { roomId });
    });

    // Access Payload CMS from your handlers
    socket.on("get-user-data", async () => {
      const user = await payload.findByID({
        collection: "users",
        id: socket.user!.id as string,
      });
      socket.emit("user-data", user);
    });
  },
});
```

**Organized in separate files (recommended):**

```typescript
// Import from examples directory
import { projectHandlers } from "./examples/projectHandlers";
import { chatHandlers } from "./examples/chatHandlers";
import { notificationHandlers } from "./examples/notificationHandlers";

// Or import all at once
import {
  projectHandlers,
  chatHandlers,
  notificationHandlers,
} from "./examples";

socketPlugin({
  onSocketConnection: (socket, io, payload) => {
    // Use one or more pre-built handlers
    projectHandlers(socket, io, payload);
    chatHandlers(socket, io, payload);
    notificationHandlers(socket, io, payload);
  },
});
```

**See the [examples directory](./examples) for complete implementations** including:

| Handler                   | Features                                                             |
| ------------------------- | -------------------------------------------------------------------- |
| **Project Collaboration** | Join/leave rooms, permission checking, presence tracking, kick users |
| **Chat/Messaging**        | Send messages, typing indicators, read receipts                      |
| **Notifications**         | User notifications, broadcast announcements (admin only)             |

Each example includes full client-side and server-side code with error handling and best practices.

### Custom Event Filtering

```typescript
socketPlugin({
  shouldEmit: (event) => {
    // Only emit events for published documents
    return event.doc?.status === "published";
  },
});
```

### Event Transformation

```typescript
socketPlugin({
  transformEvent: (event) => {
    // Remove sensitive data before emitting
    const { doc, ...rest } = event;
    return {
      ...rest,
      doc: {
        id: doc.id,
        title: doc.title,
        // Omit sensitive fields
      },
    };
  },
});
```

## How It Works

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Client    │◄───────►│  Socket.IO   │◄───────►│   Payload   │
│ (Browser)   │  WebSocket │   Server     │  Hooks  │    CMS      │
└─────────────┘         └──────────────┘         └─────────────┘
                              │
                              ▼
                        ┌──────────────┐
                        │    Redis     │
                        │   Adapter    │
                        └──────────────┘
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
              ┌──────────┐        ┌──────────┐
              │ Instance │        │ Instance │
              │    1     │        │    2     │
              └──────────┘        └──────────┘
```

**Flow:**

1. Plugin hooks into Payload's `afterChange` and `afterDelete` lifecycle events
2. When a document changes, the plugin creates an event payload
3. Event is broadcast via Socket.IO to all connected clients
4. Authorization handlers determine which users receive the event
5. Redis adapter ensures events sync across multiple server instances

## Browser Compatibility

This plugin includes automatic browser-safe mocking for the Payload admin panel. When bundled for the browser (e.g., in the Payload admin UI), the plugin automatically uses a mock implementation that:

- Returns the config unchanged (no Socket.IO server initialization)
- Provides no-op functions for `initSocketIO()` and `SocketIOManager` methods
- Prevents server-side dependencies (Socket.IO, Redis) from being bundled in the browser

This is handled automatically via the `"browser"` field in `package.json`, so you don't need to configure anything special. The Socket.IO server only runs on the server side.

## Environment Variables

The plugin does not read environment variables directly. You can use environment variables in your configuration:

```bash
# Example: Redis URL for multi-instance support
REDIS_URL=redis://localhost:6379

# Optional: Payload configuration
PAYLOAD_SECRET=your-secret-key
```

Then pass them in your plugin configuration:

```typescript
socketPlugin({
  redis: {
    url: process.env.REDIS_URL,
  },
});
```

## TypeScript Types

```typescript
import type {
  CollectionAuthorizationHandler,
  RealtimeEventPayload,
  AuthenticatedSocket,
  EventType,
} from "payload-socket-plugin";
```

## Troubleshooting

### Connection Issues

**Problem**: Client can't connect to Socket.IO server

**Solutions**:

- Verify CORS settings in `socketIO.cors` configuration
- Check that `initSocketIO()` is called after starting the HTTP server
- Ensure the Socket.IO path matches between server and client (default: `/socket.io`)
- Verify JWT token is valid and not expired

### Events Not Received

**Problem**: Connected but not receiving events

**Solutions**:

- Check that you've subscribed to the collection: `socket.emit('join-collection', 'collectionName')`
- Verify the collection is in `includeCollections` array
- Check authorization handler - it may be blocking events for your user
- Ensure the event type (create/update/delete) is being triggered

### Redis Connection Issues

**Problem**: Redis adapter not working in multi-instance setup

**Solutions**:

- Verify `redis.url` is set correctly in plugin options
- Check Redis server is running and accessible
- Ensure both server instances use the same Redis URL
- Check Redis logs for connection errors
- Make sure you're passing the Redis URL in the plugin configuration, not relying on environment variables

### TypeScript Errors

**Problem**: Type errors when using the plugin

**Solutions**:

- Ensure `payload-socket-plugin` types are installed
- Check that your `tsconfig.json` includes the plugin's types
- Verify Payload CMS version compatibility (>= 2.0.0)

## Performance Considerations

- **Redis**: Highly recommended for production multi-instance deployments
- **Authorization**: Keep authorization handlers lightweight - they run on every event
- **Event Filtering**: Use `shouldEmit` to reduce unnecessary events
- **Event Transformation**: Use `transformEvent` to minimize payload size

## Security Considerations

- **JWT Authentication**: All connections require valid Payload JWT tokens
- **Authorization Handlers**: Always implement proper authorization to prevent data leaks
- **CORS**: Configure CORS carefully to only allow trusted origins
- **Event Data**: Be cautious about sensitive data in events - use `transformEvent` to sanitize

## Known Limitations

- Authorization handlers are called for each connected user on every event
- No built-in event replay or history mechanism
- Redis is required for multi-instance deployments

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for version history.

## License

MIT © [Bibek Thapa](https://github.com/beewhoo)

## Contributing

Contributions are welcome! Please open an issue or PR.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Support

For issues and questions, please [open a GitHub issue](https://github.com/beewhoo/payload-socket-plugin/issues).
