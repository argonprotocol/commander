export default function createPromise<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: any) => void;
} {
  let promiseResolve!: (value: T) => void;
  let promiseReject!: (reason?: any) => void;
  let promise: Promise<T> = new Promise((resolve, reject) => {
    promiseResolve = resolve;
    promiseReject = reject;
  });

  return {
    promise,
    resolve: promiseResolve,
    reject: promiseReject,
  };
}
