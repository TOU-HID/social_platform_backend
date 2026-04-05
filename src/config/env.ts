import dotenv from 'dotenv';

dotenv.config();

const toBoolean = (value: string | undefined, fallback = false) => {
  if (typeof value === 'undefined') return fallback;
  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
};

const get = (key: string, fallback?: string) => {
  const value = process.env[key] ?? fallback;
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
};

export const env = {
  port: Number(process.env.PORT || 5000),
  mongodbUri: get('MONGODB_URI'),
  clientOrigin: get('CLIENT_ORIGIN', 'http://localhost:5173'),
  accessTokenSecret: get('ACCESS_TOKEN_SECRET'),
  refreshTokenSecret: get('REFRESH_TOKEN_SECRET'),
  accessTokenExpiresIn: get('ACCESS_TOKEN_EXPIRES_IN', '15m'),
  refreshTokenExpiresIn: get('REFRESH_TOKEN_EXPIRES_IN', '7d'),
  useCloudinary: toBoolean(process.env.USE_CLOUDINARY, false),
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || '',
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || '',
  cloudinaryFolder: process.env.CLOUDINARY_FOLDER || 'social-platform/posts',
};
