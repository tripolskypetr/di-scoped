import { AsyncLocalStorage } from 'async_hooks';

interface IScopedClassType<Args extends any[]> {
  new (...args: Args): any;
}

interface IScopedClassRun<Args extends any[]> {
  runInContext<Result = unknown>(callback: () => Result, ...args: Args): Result;
  runAsyncIterator<T, TReturn = any, TNext = unknown>(iterator: AsyncGenerator<T, TReturn, TNext>, ...ctorArgs: Args): AsyncGenerator<T, TReturn, TNext>
}

type ScopedClassTypeActivator<Args extends any[], ClassType extends IScopedClassType<Args>> = {
  new (): InstanceType<ClassType>;
} & Omit<ClassType, 'prototype'>;

export class ScopeContextError extends Error {}

export const scoped = <ClassType extends new (...args: any[]) => any>(
  ClassCtor: ClassType
): ScopedClassTypeActivator<ConstructorParameters<ClassType>, ClassType> & IScopedClassRun<ConstructorParameters<ClassType>> => {
  const asyncStorage = new AsyncLocalStorage<ConstructorParameters<ClassType>>();
  const referenceMap = new WeakMap<ConstructorParameters<ClassType>, InstanceType<ClassType>>();

  class ClassReferer {
    constructor() {
      const proxyInstance = new Proxy(this, {
        get(_, propKey, receiver) {
          if (propKey === 'init') {
            return;
          }
          const referenceKey = asyncStorage.getStore();
          if (!referenceKey) {
            throw new ScopeContextError('di-scoped ContextReferer not running in context');
          }
          let reference = referenceMap.get(referenceKey)!;
          if (!reference) {
            reference = referenceMap.set(referenceKey, new ClassCtor(...referenceKey)).get(referenceKey)!;
          }
          return Reflect.get(reference, propKey, receiver);
        },
        set(_, propKey, value, receiver) {
          const referenceKey = asyncStorage.getStore();
          if (!referenceKey) {
            throw new ScopeContextError('di-scoped ContextReferer not running in context');
          }
          let reference = referenceMap.get(referenceKey)!;
          if (!reference) {
            reference = referenceMap.set(referenceKey, new ClassCtor(...referenceKey)).get(referenceKey)!;
          }
          return Reflect.set(reference, propKey, value, receiver);
        },
      });
      Object.setPrototypeOf(this, proxyInstance);
    }
  }

  const classInstance = new ClassReferer();

  function ClassActivator() {
    return classInstance;
  }

  ClassActivator.runInContext = (fn: () => unknown, ...args: ConstructorParameters<ClassType>) => {
    referenceMap.set(args, new ClassCtor(...args));
    return asyncStorage.run(args, fn);
  };

  ClassActivator.runAsyncIterator = function <T, TReturn = any, TNext = unknown>(
    iterator: AsyncGenerator<T, TReturn, TNext>,
    ...ctorArgs: ConstructorParameters<ClassType>
  ): AsyncGenerator<T, TReturn, TNext> {
    referenceMap.set(ctorArgs, new ClassCtor(...ctorArgs));
    return {
      async next(...args: [] | [TNext]): Promise<IteratorResult<T>> {
        return asyncStorage.run(ctorArgs, () => iterator.next(...args));
      },
      async return(value?: TReturn | PromiseLike<TReturn>): Promise<IteratorResult<T>> {
        if (iterator.return) {
          return asyncStorage.run(ctorArgs, () => iterator.return!(value!));
        }
        return Promise.resolve({ value: undefined as any, done: true } as IteratorResult<T>);
      },
      async throw(...args: [any]): Promise<IteratorResult<T>> {
        if (iterator.throw) {
          return asyncStorage.run(ctorArgs, () => iterator.throw!(...args));
        }
        return Promise.reject(new Error("Iterator does not support throwing errors"));
      },
      [Symbol.asyncIterator](): AsyncGenerator<T, TReturn, TNext> {
        return this;
      },
      async [Symbol.asyncDispose]() {
        if (typeof iterator[Symbol.asyncDispose] === "function") {
          return asyncStorage.run(ctorArgs, () => iterator[Symbol.asyncDispose]!());
        }
        return Promise.resolve();
      },
    }
  };

  return ClassActivator as unknown as ScopedClassTypeActivator<ConstructorParameters<ClassType>, ClassType> & IScopedClassRun<ConstructorParameters<ClassType>>;
};

export type { IScopedClassType, IScopedClassRun, ScopedClassTypeActivator } 

/*
const TestClass = scoped(class {

    constructor(private name: string) {
    }

    test() {
        console.log(`Hello, ${this.name}`);
    }
});
*/


// TestClass.runInContext(() => {
//    new TestClass().test(); // Hello, Peter
// }, "Peter")

// new TestClass().test(); // ScopeContextError('di-scoped ContextReferer not running in context');

/*
let instanceRef1;
let instanceRef2;

TestClass.runInContext(() => {
    instanceRef1 = new TestClass()
    instanceRef1.test() // Hello, Peter
}, "Peter")

TestClass.runInContext(() => {
    instanceRef2 = new TestClass()
    instanceRef2.test() // Hello, not Peter
}, "not Peter")

if (TestClass === TestClass) {
    console.log("Ok! This is the same class")
}
if (instanceRef1 === instanceRef2) {
    console.log("OMG! This is the same instance")
}
*/
