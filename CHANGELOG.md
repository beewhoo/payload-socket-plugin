# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-01-19

### Breaking Changes

- **Payload v3 Support**: Updated to support Payload CMS v3.72.0+
- **`initSocketIO` Signature Change**: Now requires the Payload instance as a second parameter
  - Old: `initSocketIO(httpServer)`
  - New: `initSocketIO(httpServer, payloadInstance)`
- **Import Path Changes**: Updated imports to use Payload v3 conventions
  - Changed from `import type { CollectionConfig } from "payload/types"` to `import type { CollectionConfig } from "payload"`
- **Minimum Node.js Version**: Now requires Node.js >= 20.0.0

### Changed

- Updated peer dependency to `payload@^3.72.0`
- Refactored `SocketIOManager` to accept Payload instance as parameter instead of importing it
- Updated `initSocketIO` to pass Payload instance to socket manager
- Updated TypeScript configuration for Payload v3 compatibility
- Updated package.json exports configuration for better ESM/CommonJS compatibility

### Added

- Added comprehensive migration guide in README
- Added Payload v3 usage examples
- Added Next.js custom server integration example

### Fixed

- Fixed module resolution issues in Next.js applications
- Fixed server-side import bundling in client-side code

### Migration Guide

See the [Migration Guide](./README.md#migration-guide) section in the README for detailed upgrade instructions.

## [1.1.5] - 2024-XX-XX

### Added

- Initial stable release for Payload v2
- Real-time event broadcasting for collection changes
- Redis support for multi-instance deployments
- Per-collection authorization handlers
- JWT authentication for WebSocket connections
- TypeScript support with full type definitions
- Flexible CORS and Socket.IO configuration

### Features

- `includeCollections` option to specify which collections to broadcast
- `authorize` handlers for fine-grained access control
- `shouldEmit` filter function for event filtering
- `transformEvent` function for event transformation
- `onSocketConnection` callback for custom socket handling
- Redis adapter for horizontal scaling

[2.0.0]: https://github.com/beewhoo/payload-socket-plugin/compare/v1.1.5...v2.0.0
[1.1.5]: https://github.com/beewhoo/payload-socket-plugin/releases/tag/v1.1.5

