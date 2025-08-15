import { invoke } from '@tauri-apps/api/core';

export { invoke };

export class InvokeTimeout extends Error {
  constructor(message: string) {
    super(message);
  }
}

export function invokeWithTimeout<T>(cmd: string, args: Record<string, any>, timeoutMs: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new InvokeTimeout('Invoke timed out')), timeoutMs),
  );

  try {
    const invocation = invoke<T>(cmd, args);
    return Promise.race([invocation, timeout]);
  } catch (e) {
    console.error(`Error invoking ${cmd}`, e);
    throw e;
  }
}
