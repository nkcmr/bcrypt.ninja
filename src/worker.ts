var worker = new Worker("/sw.js");

type QueueItem<T> = {
  op: string;
  args: any[];
  resolve?: (value: T | PromiseLike<T>) => void;
  reject?: (reason?: any) => void;
};

const messageQueue = (() => {
  const queue: Array<QueueItem<any>> = [];
  let idleWakeup: (value: void | PromiseLike<void>) => void = () => {};
  function idle() {
    return new Promise<void>((resolve) => {
      idleWakeup = () => {
        idleWakeup = () => {};
        resolve();
      };
    });
  }
  const waitForMessage = (() => {
    let resolveResult: (value: string | PromiseLike<string>) => void = () => {};
    let rejectResult: (reason?: any) => void;
    worker.addEventListener("message", (e) => {
      if (e.data.error) {
        rejectResult(e.data.error);
      } else {
        resolveResult(e.data.result);
      }
    });
    return (): Promise<string> => {
      return new Promise((resolve, reject) => {
        resolveResult = resolve;
        rejectResult = reject;
      });
    };
  })();
  (async () => {
    for (;;) {
      if (queue.length === 0) {
        await idle();
        continue;
      }
      const item = queue.shift();
      if (!item) {
        continue;
      }
      const message = waitForMessage();
      worker.postMessage({
        op: item.op,
        args: item.args,
      });
      try {
        const reply = await message;
        if (item.resolve) {
          item.resolve(reply);
        }
      } catch (e) {
        if (item.reject) {
          item.reject(e);
        }
      }
    }
  })();
  return function enqueue<T>(item: QueueItem<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      queue.push({ ...item, resolve, reject });
      idleWakeup();
    });
  };
})();

export function bcryptVerify(hash: string, secret: string): Promise<boolean> {
  return messageQueue({
    op: "bcrypt_verify",
    args: [hash, secret],
  });
}

export function bcryptHash(cost: number, secret: string): Promise<string> {
  return messageQueue({
    op: "bcrypt_hash",
    args: [cost, secret],
  });
}
