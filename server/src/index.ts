import { config } from './config/env';
import http from 'http';
import { createApp } from './app';
import { connectDatabase, disconnectDatabase } from './config/database';
import { SocketService } from './socket/socket.service';
import { MigrationService } from './services/migration.service';
import { StorageService } from './services/storage.service';

const startServer = async (): Promise<void> => {
  const app = createApp();
  const httpServer = http.createServer(app);

  // Report whether Cloudinary is configured (uploads are rejected, never saved locally, if not)
  StorageService.logStartupStatus();

  // Initialize Socket.IO with WebSocket and JWT handshake
  SocketService.init(httpServer);

  // Attempt database connection (non-blocking for health check)
  await connectDatabase();

  // Run legacy user approval status migration safely and idempotently
  await MigrationService.runApprovalsMigration();

  const server = httpServer.listen(config.port, '0.0.0.0', () => {
    console.log(`===============================================`);
    console.log(`  ShaadiBanao Server running on port ${config.port}`);
    console.log(`  Host Binding: 0.0.0.0 (LAN Accessible)`);
    console.log(`  Environment: ${config.nodeEnv}`);
    console.log(`  Real-Time WebSockets: Active via Socket.IO`);
    console.log(`  Health Check: http://localhost:${config.port}/api/v1/health`);
    console.log(`===============================================`);
  });

  const handleShutdown = async (signal: string) => {
    console.log(`\n[Server] Received ${signal}. Gracefully shutting down...`);
    server.close(async () => {
      await disconnectDatabase();
      console.log('[Server] HTTP server closed. Process exiting.');
      process.exit(0);
    });

    // Force exit after 10s if graceful shutdown hangs
    setTimeout(() => {
      console.error('[Server] Could not close connections in time, forcefully shutting down.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
};

startServer().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});
