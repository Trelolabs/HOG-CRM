import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Shared Redis connection for BullMQ
export const redisConnection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
});

redisConnection.on('ready', () => {
  console.log('[Redis] Connected and ready');
});

redisConnection.on('error', (err) => {
  console.error('[Redis] Connection error:', err);
});
