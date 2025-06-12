import * as Fs from 'node:fs';
import express from 'express';

export function onExit(fn: () => void | Promise<void>) {
  const handler = async () => {
    await fn();
    process.exit(0);
  };

  process.once('SIGINT', handler);
  process.once('SIGTERM', handler);
  process.once('exit', () => fn());
}

export function requireEnv<K extends keyof (typeof process)['env']>(envVar: K): string {
  if (!process.env[envVar]) throw new Error(`process.env.${envVar} is required`);
  return process.env[envVar] as any;
}

export function requireAll<T>(data: Partial<T>): T {
  for (const [key, value] of Object.entries(data)) {
    if (!value) throw new Error(`Required ${key}`);
  }
  return data as T;
}

export function jsonExt(data: any, response: express.Response) {
  const json = JSON.stringify(
    data,
    (_key, value) => {
      if (typeof value === 'bigint') {
        return `${value}n`;
      }
      return value;
    },
    2,
  );
  response.status(200).type('application/json').send(json);
}

export function readJsonFileOrNull(path: string) {
  try {
    return JSON.parse(Fs.readFileSync(path, 'utf8'));
  } catch (error) {
    return null;
  }
}
