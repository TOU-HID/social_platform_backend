"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const get = (key, fallback) => {
    const value = process.env[key] ?? fallback;
    if (!value) {
        throw new Error(`Missing environment variable: ${key}`);
    }
    return value;
};
exports.env = {
    port: Number(process.env.PORT || 5000),
    mongodbUri: get('MONGODB_URI'),
    clientOrigin: get('CLIENT_ORIGIN', 'http://localhost:5173'),
    allowAllOrigins: (process.env.ALLOW_ALL_ORIGINS || 'false').toLowerCase() === 'true',
    allowedOrigins: get('CLIENT_ORIGIN', 'http://localhost:5173')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    accessTokenSecret: get('ACCESS_TOKEN_SECRET'),
    refreshTokenSecret: get('REFRESH_TOKEN_SECRET'),
    accessTokenExpiresIn: get('ACCESS_TOKEN_EXPIRES_IN', '15m'),
    refreshTokenExpiresIn: get('REFRESH_TOKEN_EXPIRES_IN', '7d'),
    useCloudinary: (process.env.USE_CLOUDINARY || 'false').toLowerCase() === 'true',
    cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || '',
    cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || '',
    cloudinaryFolder: process.env.CLOUDINARY_FOLDER || 'social-platform/posts',
};
