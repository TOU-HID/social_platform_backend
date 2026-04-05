import mongoose from 'mongoose';
import { env } from './env';

let isConnected = false;

export const connectDatabase = async () => {
  if (isConnected) return;

  await mongoose.connect(env.mongodbUri, {
    maxPoolSize: 50,
    minPoolSize: 10,
    maxIdleTimeMS: 300000,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 30000,
    connectTimeoutMS: 10000,
  });

  isConnected = true;
};
