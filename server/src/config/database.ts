import dns from 'dns';
import mongoose from 'mongoose';
import { config } from './env';

export type DbStatus = 'connected' | 'disconnected' | 'connecting' | 'unconfigured';

let dbStatus: DbStatus = 'disconnected';

/**
 * Masks sensitive credentials in MongoDB connection string
 * Example: mongodb+srv://admin:secret123@cluster.net -> mongodb+srv://admin:****@cluster.net
 */
export const maskMongoUri = (uri: string): string => {
  if (!uri) return '';
  return uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');
};

/**
 * Validates MongoDB URI format securely
 */
export const validateMongoUri = (uri: string): { valid: boolean; reason?: string } => {
  if (!uri || !uri.trim()) {
    return { valid: false, reason: 'MONGODB_URI is empty' };
  }
  const cleanUri = uri.trim();
  if (cleanUri.includes('<db_password>') || cleanUri.includes('<password>')) {
    return {
      valid: false,
      reason:
        'Placeholder password detected in MONGODB_URI. Please replace <db_password> with your actual database user password in server/.env.',
    };
  }
  if (!cleanUri.startsWith('mongodb://') && !cleanUri.startsWith('mongodb+srv://')) {
    return {
      valid: false,
      reason: 'Invalid protocol: MongoDB connection string must start with mongodb:// or mongodb+srv://',
    };
  }
  return { valid: true };
};

export const getDbStatus = (): { status: DbStatus; host?: string; isProduction: boolean } => {
  if (!config.mongodbUri) {
    return { status: 'unconfigured', isProduction: config.isProduction };
  }

  const state = mongoose.connection.readyState;
  switch (state) {
    case 1:
      return { status: 'connected', host: mongoose.connection.host, isProduction: config.isProduction };
    case 2:
      return { status: 'connecting', isProduction: config.isProduction };
    default:
      return { status: 'disconnected', isProduction: config.isProduction };
  }
};

export const isDbReady = (): boolean => mongoose.connection.readyState === 1;

export const connectDatabase = async (): Promise<void> => {
  if (!config.mongodbUri) {
    if (config.isProduction) {
      console.error(
        '[Database CRITICAL] Running in production mode, but MONGODB_URI is not set! In-memory fallbacks are prohibited in production.'
      );
      dbStatus = 'unconfigured';
      return;
    }
    console.warn('[Database] MONGODB_URI is not set. Running in development offline/in-memory fallback mode.');
    dbStatus = 'unconfigured';
    return;
  }

  const validation = validateMongoUri(config.mongodbUri);
  if (!validation.valid) {
    console.error(`[Database Error] ${validation.reason}`);
    dbStatus = 'disconnected';
    return;
  }

  const masked = maskMongoUri(config.mongodbUri);

  // If using SRV protocol, ensure DNS resolves SRV records via reliable public DNS resolvers
  if (config.mongodbUri.startsWith('mongodb+srv://')) {
    try {
      dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
    } catch {
      // Continue if DNS server override is not permitted
    }
  }

  try {
    dbStatus = 'connecting';
    console.log(`[Database] Connecting to MongoDB (${masked})...`);
    await mongoose.connect(config.mongodbUri, {
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 15000,
      maxPoolSize: 10,
      minPoolSize: 1,
      maxIdleTimeMS: 30000,
    });
    dbStatus = 'connected';
    console.log(`[Database] Successfully connected to MongoDB at ${mongoose.connection.host}`);
  } catch (error) {
    dbStatus = 'disconnected';
    console.error('[Database] Failed to connect to MongoDB:', (error as Error).message);
    if (config.isProduction) {
      console.error('[Database CRITICAL] Production database unreachable. Mocks are prohibited.');
    } else {
      console.warn('[Database] The server will remain running for non-database operations, health check, and dev mocks.');
    }
  }

  mongoose.connection.on('error', (err) => {
    console.warn('[Database Connection Error]', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[Database] Lost connection to MongoDB.');
    dbStatus = 'disconnected';
  });

  mongoose.connection.on('reconnected', () => {
    console.log('[Database] Reconnected to MongoDB.');
    dbStatus = 'connected';
  });
};

export const disconnectDatabase = async (): Promise<void> => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    dbStatus = 'disconnected';
    console.log('[Database] Disconnected from MongoDB.');
  }
};
