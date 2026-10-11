import mongoose from 'mongoose';
import { config } from './env';

export type DbStatus = 'connected' | 'disconnected' | 'connecting' | 'unconfigured';

let dbStatus: DbStatus = 'disconnected';

export const getDbStatus = (): { status: DbStatus; host?: string } => {
  if (!config.mongodbUri) {
    return { status: 'unconfigured' };
  }

  const state = mongoose.connection.readyState;
  switch (state) {
    case 1:
      return { status: 'connected', host: mongoose.connection.host };
    case 2:
      return { status: 'connecting' };
    default:
      return { status: 'disconnected' };
  }
};

export const connectDatabase = async (): Promise<void> => {
  if (!config.mongodbUri) {
    console.warn('[Database] MONGODB_URI is not set. Running in offline/disconnected database mode.');
    dbStatus = 'unconfigured';
    return;
  }

  try {
    dbStatus = 'connecting';
    console.log('[Database] Connecting to MongoDB...');
    await mongoose.connect(config.mongodbUri, {
      serverSelectionTimeoutMS: 5000,
    });
    dbStatus = 'connected';
    console.log(`[Database] Successfully connected to MongoDB at ${mongoose.connection.host}`);
  } catch (error) {
    dbStatus = 'disconnected';
    console.error('[Database] Failed to connect to MongoDB:', (error as Error).message);
    console.warn('[Database] The server will remain running for non-database operations and health check.');
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
