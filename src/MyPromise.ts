import { OnFulfilledFn, OnRejectedFn, PromiseFn } from "./util/types";

const defer = (fn) => setTimeout(fn, 0);

const tryCatch = (t, c) => {
  try {
    t();
  } catch (err) {
    c(err);
  }
};

export function MyPromise(fn?: PromiseFn) {
  let fullfilledQueue = [];
  let rejectQueue = [];
  let state = "pending";
  let resolvedVal;
  let rejectedVal;

  const throwRejection = (err) => {
    rejectQueue.forEach((onRejected) => {
      onRejected(err);
    });
    state = "rejected";
  };

  const flushFulfilled = () => {
    defer(() => {
      fullfilledQueue.forEach((onFullfilled) => {
        tryCatch(() => {
          const fullfilledValue = onFullfilled(resolvedVal);

          if (
            !(typeof fullfilledValue === "function") &&
            !(fullfilledValue instanceof Object)
          ) {
            resolvedVal = fullfilledValue;
          }
        }, throwRejection);
      });

      fullfilledQueue = [];
    });
  };

  const flushRejected = () => {
    defer(() => {
      rejectQueue.forEach((onRejected, i) => {
        tryCatch(
          () => {
            onRejected(rejectedVal);
          },
          (err) => {
            rejectQueue.splice(i, 1);
            rejectQueue.forEach((onRejected) => {
              onRejected(err);
            });
          }
        );
      });

      rejectQueue = [];
    });
  };

  const promise = {
    resolve: (val: any) => {
      if (promise === val) {
        rejectQueue.forEach((onRejected) => {
          onRejected(TypeError);
        });
        state = "rejected";
        return;
      }

      if (state !== "pending") {
        return;
      }

      tryCatch(() => {
        if (val instanceof Promise || val.then) {
          val.then(
            (onFullfilled) => {
              if (state !== "pending") {
                return;
              }

              promise.resolve(onFullfilled);

              return promise;
            },
            (err) => {
              if (state !== "pending") {
                return;
              }

              throwRejection(err);
            }
          );
          state = "resolved";
        } else {
          resolvedVal = val;
          flushFulfilled();
          state = "resolved";
        }
      }, throwRejection);
    },

    reject: (val) => {
      if (state !== "pending") {
        return;
      }

      rejectedVal = val;

      flushRejected();

      state = "rejected";
    },

    then: (onFullfilled: OnFulfilledFn, onRejected: OnRejectedFn) => {
      if (onFullfilled) {
        fullfilledQueue.push(onFullfilled);
      }

      if (onRejected) {
        rejectQueue.push(onRejected);
      }

      if (state === "resolved") {
        flushFulfilled();
      } else if (state === "rejected") {
        flushRejected();
      }

      return promise;
    },
  };

  fn(promise.resolve, promise.reject);

  return promise;
}
