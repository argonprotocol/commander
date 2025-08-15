// util.ts
import type { ArgonClient } from '@argonprotocol/mainchain';

type AnyFn = (...args: any[]) => any;

const cbCache = new WeakMap<Function, Function>();
const fnCache = new WeakMap<Function, Function>();
const reverseObj = new WeakMap<object, object>();
const methodCache = new WeakMap<Function, Function>();

function captureCallerStack(skip = 2) {
  const s = new Error().stack ?? '';
  return s.split('\n').slice(skip).join('\n');
}

function augment(err: unknown, callerStack: string, name: string): Error {
  if (err && typeof err === 'object') {
    const e = err as Error;
    const msg = e.message ?? String(err);
    if (!msg.includes(`${name}:`)) {
      // If the error message does not already include the name, prepend it
      e.message = `${name}: ${msg}`;
    }
    if (e.stack && !e.stack.includes('--- caller stack ---')) {
      e.stack += `\n\n--- caller stack ---\n${callerStack}`;
    }
    return e;
  }
  return new Error(`Non-Error thrown: ${String(err)}\n\n--- caller stack ---\n${callerStack}`);
}

function wrapFunction(fn: AnyFn, name: string): AnyFn {
  // Reuse a previously wrapped function to keep identity stable
  const existing = fnCache.get(fn);
  if (existing) return existing as AnyFn;

  const prox = new Proxy(fn, {
    apply(target, thisArg, argList) {
      const callerStack = captureCallerStack();

      // Wrap callbacks but keep identity stable across .on/.off calls
      const wrappedArgs = argList.map(a => {
        if (typeof a === 'function') {
          let wrapped = cbCache.get(a);
          if (!wrapped) {
            wrapped = function (this: any, ...cbArgs: any[]) {
              try {
                return (a as AnyFn).apply(this, cbArgs);
              } catch (e) {
                throw augment(e, callerStack, name);
              }
            };
            cbCache.set(a, wrapped);
          }
          return wrapped;
        }
        return a;
      });

      try {
        const realThis =
          thisArg && typeof thisArg === 'object' ? (reverseObj.get(thisArg as object) ?? thisArg) : thisArg;
        const out = Reflect.apply(target, realThis, wrappedArgs);

        // If it’s a Promise/thenable, attach a rejection handler using then(..., ...)
        if (out && typeof (out as any).then === 'function') {
          return (out as Promise<any>).then(
            v => v,
            e => {
              throw augment(e, callerStack, name);
            },
          );
        }
        return out;
      } catch (e) {
        throw augment(e, callerStack, name);
      }
    },
  });

  fnCache.set(fn, prox);
  return prox as unknown as AnyFn;
}

function deepProxy<T extends object>(obj: T, name: string, seen = new WeakMap<object, any>()): T {
  if (seen.has(obj)) return seen.get(obj);
  const prox = new Proxy(obj as any, {
    get(target, prop, _receiver) {
      // Use the original target as receiver so getters see the real instance
      const value = Reflect.get(target, prop, target);

      if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return value;

      if (typeof value === 'function') {
        if (prop === 'then' || prop === 'catch' || prop === 'finally') {
          const key = value as Function;
          let bound = methodCache.get(key);
          if (!bound) {
            bound = key.bind(target);
            methodCache.set(key, bound!);
          }
          return bound;
        }
        return wrapFunction(value, name);
      }
      if (typeof value === 'object') return deepProxy(value, name, seen);

      return value;
    },
    // (no set trap needed)
  });
  reverseObj.set(prox, obj as any);
  seen.set(obj, prox);
  return prox;
}

const installedSymbol = Symbol('ArgonClientWrapper.installed');
/** Wrap a Polkadot.js ApiPromise so all calls & callbacks get augmented stacks. */
export function wrapApi<T extends ArgonClient>(api: T, name: string): T {
  if (installedSymbol in api) {
    return api as T; // Already wrapped
  }
  const result = deepProxy(api, name);
  (result as any)[installedSymbol] = true; // Mark as wrapped
  return result;
}
