import { AsyncLocalStorage, AsyncResource } from 'async_hooks';

interface IScopedClassType<Args extends any[]> {
  new (...args: Args): any;
}

interface IScopedClassRun<Args extends any[]> {
  hasContext(): boolean;
  runInContext<Result = unknown>(callback: () => Result, ...args: Args): Result;
  runOutOfContext<Result = unknown>(callback: () => Result): Result;
  runAsyncIterator<T, TReturn = any, TNext = unknown>(iterator: AsyncGenerator<T, TReturn, TNext>, ...ctorArgs: Args): AsyncGenerator<T, TReturn, TNext>;
  runIterator<T, TReturn = any, TNext = unknown>(generator: Generator<T, TReturn, TNext>, ...ctorArgs: Args): Generator<T, TReturn, TNext>;
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

  ClassActivator.runOutOfContext = (fn: () => unknown) => {
    return new AsyncResource('UNTRACKED').runInAsyncScope(fn);
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
      // @ts-ignore
      async [Symbol.asyncDispose]() {
        // @ts-ignore
        if (typeof iterator[Symbol.asyncDispose] === "function") {
          // @ts-ignore
          return asyncStorage.run(ctorArgs, () => iterator[Symbol.asyncDispose]!());
        }
        return Promise.resolve();
      },
    }
  };

  ClassActivator.runIterator = function <T, TReturn = any, TNext = unknown>(
    generator: Generator<T, TReturn, TNext>,
    ...ctorArgs: ConstructorParameters<ClassType>
  ): Generator<T, TReturn, TNext> {
    referenceMap.set(ctorArgs, new ClassCtor(...ctorArgs));
    return {
      next(...args: [] | [TNext]): IteratorResult<T, TReturn> {
        return asyncStorage.run(ctorArgs, () => generator.next(...args));
      },
      return(value?: TReturn): IteratorResult<T, TReturn> {
        if (generator.return) {
          return asyncStorage.run(ctorArgs, () => generator.return!(value!));
        }
        return { value: undefined as any, done: true };
      },
      throw(...args: [any]): IteratorResult<T, TReturn> {
        if (generator.throw) {
          return asyncStorage.run(ctorArgs, () => generator.throw!(...args));
        }
        throw new Error("Generator does not support throwing errors");
      },
      [Symbol.iterator](): Generator<T, TReturn, TNext> {
        return this;
      },
    };
  };

  ClassActivator.hasContext = () => {
    return !!asyncStorage.getStore();
  };

  return ClassActivator as unknown as ScopedClassTypeActivator<ConstructorParameters<ClassType>, ClassType> & IScopedClassRun<ConstructorParameters<ClassType>>;
};

export type { IScopedClassType, IScopedClassRun, ScopedClassTypeActivator } 

/*
const TestClass = scoped(class {

    constructor(private name: string) {
    }

    test() {
      return `Hello, ${this.name}`;
    }
});
*/

/*
class TestIterator {

  test = new TestClass();

  *run() {
    yield this.test.test()
    yield this.test.test()
    yield this.test.test()
  }
}

const test = new TestIterator()

console.log([...TestClass.runIterator(test.run(), "Pahom")])
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
