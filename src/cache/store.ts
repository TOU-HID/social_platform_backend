import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 20, checkperiod: 30, useClones: false });

export const cacheKeys = {
  feed: (
    userId: string,
    cursorCreatedAt?: string,
    cursorId?: string,
    limit?: number,
  ) =>
    `feed:${userId}:${cursorCreatedAt || 'first'}:${cursorId || 'first'}:${limit || 20}`,
  comments: (userId: string, postId: string) => `comments:${userId}:${postId}`,
  likers: (userId: string, targetType: string, targetId: string) =>
    `likers:${userId}:${targetType}:${targetId}`,
};

export const readCache = <T>(key: string): T | undefined => cache.get<T>(key);

export const writeCache = <T>(key: string, value: T, ttl = 20) => {
  cache.set(key, value, ttl);
};

export const invalidateAllReadCaches = () => {
  cache.flushAll();
};
