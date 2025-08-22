// util.ts
import type { ArgonClient } from '@argonprotocol/mainchain';

type AnyFn = (...args: unknown[]) => unknown;

const cbCache = new WeakMap<AnyFn, AnyFn>();
const fnCache = new WeakMap<AnyFn, AnyFn>();
const reverseObj = new WeakMap<object, object>();
const boundMethodCache = new WeakMap<object, WeakMap<AnyFn, AnyFn>>();

function captureCallerStack(skip = 2) {
  const s = new Error().stack ?? '';
  return s.split('\n').slice(skip).join('\n');
}

function augment(err: unknown, callerStack: string, name: string): Error {
  if (err && err instanceof Error) {
    const msg = err.message ?? String(err);
    if (!msg.includes(`${name}:`)) {
      err.message = `${name}: ${msg}`;
    }
    if (err.stack && !err.stack.includes('--- caller stack ---')) {
      err.stack += `\n\n--- caller stack ---\n${callerStack}`;
    }
    return err;
  }
  return new Error(`Non-Error thrown: ${String(err)}\n\n--- caller stack ---\n${callerStack}`);
}

function isPromiseLike(x: unknown): x is PromiseLike<unknown> {
  if (x === null) return false;
  const t = typeof x;
  if (t !== 'object' && t !== 'function') return false;
  return 'then' in (x as { then?: unknown }) && typeof (x as { then?: unknown }).then === 'function';
}

function wrapFunction<T extends AnyFn>(fn: T, name: string): T {
  const existing = fnCache.get(fn);
  if (existing) return existing as unknown as T;

  const prox = new Proxy(fn, {
    apply(target, thisArg, argList: unknown[]) {
      const callerStack = captureCallerStack();

      const wrappedArgs = argList.map(a => {
        if (typeof a === 'function') {
          const key = a as AnyFn;
          let wrapped = cbCache.get(key);
          if (!wrapped) {
            wrapped = function (this: unknown, ...cbArgs: unknown[]) {
              try {
                return key.apply(this as ThisParameterType<T>, cbArgs as Parameters<T>);
              } catch (e) {
                throw augment(e, callerStack, name);
              }
            } as AnyFn;
            cbCache.set(key, wrapped);
          }
          return wrapped;
        }
        return a;
      });

      try {
        const realThis =
          thisArg && typeof thisArg === 'object' ? (reverseObj.get(thisArg as object) ?? thisArg) : thisArg;
        const out = Reflect.apply(target, realThis, wrappedArgs);

        if (isPromiseLike(out)) {
          return out.then(
            v => v,
            e => {
              throw augment(e, callerStack, name);
            },
          ) as unknown as ReturnType<T>;
        }
        return out as ReturnType<T>;
      } catch (e) {
        throw augment(e, callerStack, name);
      }
    },
  });

  fnCache.set(fn, prox as unknown as AnyFn);
  return prox as unknown as T;
}

function deepProxy<T extends object>(obj: T, name: string, seen = new WeakMap<object, unknown>()): T {
  if (seen.has(obj)) return seen.get(obj) as T;
  const prox = new Proxy(obj as unknown as Record<PropertyKey, unknown>, {
    get(target, prop, _receiver) {
      // ✅ use the real instance as `this` for accessors
      const value = Reflect.get(target, prop, target);

      if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return value;

      if (typeof value === 'function') {
        if (prop === 'then' || prop === 'catch' || prop === 'finally') {
          const fn = value as AnyFn;
          let byMethod = boundMethodCache.get(target as object);
          if (!byMethod) {
            byMethod = new WeakMap<AnyFn, AnyFn>();
            boundMethodCache.set(target as object, byMethod);
          }
          let bound = byMethod.get(fn);
          if (!bound) {
            bound = fn.bind(target);
            byMethod.set(fn, bound);
          }
          return bound;
        }
        return wrapFunction(value as AnyFn, name);
      }
      if (typeof value === 'object') return deepProxy(value, name, seen);

      return value;
    },
    // (no set trap needed)
  });
  reverseObj.set(prox as unknown as object, obj as unknown as object);
  seen.set(obj, prox);
  return prox as T;
}

const installedSymbol = Symbol('ArgonClientWrapper.installed');
/** Wrap a Polkadot.js ApiPromise so all calls & callbacks get augmented stacks. */
export function wrapApi<T extends ArgonClient>(api: T, name: string): T {
  if (installedSymbol in (api as object)) {
    return api; // Already wrapped
  }
  const result = deepProxy(api, name);
  Object.defineProperty(result, installedSymbol, {
    value: true,
    enumerable: false,
    configurable: false,
  });
  return result;
}
