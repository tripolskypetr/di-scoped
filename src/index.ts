import { AsyncLocalStorage } from 'async_hooks';

interface IScopedClassType<Args extends any[]> {
  new (...args: Args): any;
}

interface IScopedClassRun<Args extends any[]> {
  runInContext<Result = unknown>(callback: () => Result, ...args: Args): Result;
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
          const reference = referenceMap.has(referenceKey)
            ? referenceMap.get(referenceKey)!
            : referenceMap.set(referenceKey, new ClassCtor(...referenceKey)).get(referenceKey)!;
          return Reflect.get(reference, propKey, receiver);
        },
        set(target, propKey, value, receiver) {
          return Reflect.set(target, propKey, value, receiver);
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
    return asyncStorage.run(args, fn);
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
