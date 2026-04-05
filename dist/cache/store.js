"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.invalidateAllReadCaches = exports.writeCache = exports.readCache = exports.cacheKeys = void 0;
const node_cache_1 = __importDefault(require("node-cache"));
const cache = new node_cache_1.default({ stdTTL: 20, checkperiod: 30, useClones: false });
exports.cacheKeys = {
    feed: (userId, cursorCreatedAt, cursorId, limit) => `feed:${userId}:${cursorCreatedAt || 'first'}:${cursorId || 'first'}:${limit || 20}`,
    comments: (userId, postId) => `comments:${userId}:${postId}`,
    likers: (userId, targetType, targetId) => `likers:${userId}:${targetType}:${targetId}`,
};
const readCache = (key) => cache.get(key);
exports.readCache = readCache;
const writeCache = (key, value, ttl = 20) => {
    cache.set(key, value, ttl);
};
exports.writeCache = writeCache;
const invalidateAllReadCaches = () => {
    cache.flushAll();
};
exports.invalidateAllReadCaches = invalidateAllReadCaches;
