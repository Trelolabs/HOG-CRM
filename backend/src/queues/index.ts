import { Queue } from 'bullmq';
import { redisConnection } from '../workers/redisClient';

export const uploadQueue = new Queue('uploadQueue', { connection: redisConnection as any });
export const emailQueue = new Queue('emailQueue', { connection: redisConnection as any });
