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

  try {
    dbStatus = 'connecting';
    console.log(`[Database] Connecting to MongoDB (${masked})...`);
    await mongoose.connect(config.mongodbUri, {
      serverSelectionTimeoutMS: 5000,
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
