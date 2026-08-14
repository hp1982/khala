import { EventEmitter } from 'node:events';
import RedisMock from 'ioredis-mock';
import type { Redis as RedisClient } from 'ioredis';
import type { KeyvStoreAdapter } from 'keyv';

/**
 * 开发/测试阶段使用的 Redis 内存模拟存储。
 * 基于 ioredis-mock，实现了 keyv 存储适配器接口，
 * 可直接作为 @nestjs/cache-manager 的 stores 使用。
 */
export class RedisMockStore extends EventEmitter implements KeyvStoreAdapter {
  readonly opts: any;
  private readonly client: RedisClient;

  constructor() {
    super();
    this.client = new RedisMock();
    this.opts = { namespace: undefined };
  }

  async get<Value>(key: string): Promise<Value | undefined> {
    const raw = await this.client.get(key);
    return raw === null ? undefined : (raw as Value);
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    if (ttl === undefined) {
      await this.client.set(key, value);
    } else {
      await this.client.set(key, value, 'PX', ttl);
    }
  }

  async delete(key: string): Promise<boolean> {
    return (await this.client.del(key)) > 0;
  }

  async clear(): Promise<void> {
    await this.client.flushdb();
  }

  async has(key: string): Promise<boolean> {
    return (await this.client.exists(key)) > 0;
  }

  async disconnect(): Promise<void> {
    this.client.disconnect();
  }
}