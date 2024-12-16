interface IScopedClassType<Args extends any[]> {
    new (...args: Args): any;
}
interface IScopedClassRun<Args extends any[]> {
    runInContext<Result = unknown>(callback: () => Result, ...args: Args): Result;
    runAsyncIterator<T, TReturn = any, TNext = unknown>(iterator: AsyncGenerator<T, TReturn, TNext>, ...ctorArgs: Args): AsyncGenerator<T, TReturn, TNext>;
    runIterator<T, TReturn = any, TNext = unknown>(generator: Generator<T, TReturn, TNext>, ...ctorArgs: Args): Generator<T, TReturn, TNext>;
}
type ScopedClassTypeActivator<Args extends any[], ClassType extends IScopedClassType<Args>> = {
    new (): InstanceType<ClassType>;
} & Omit<ClassType, 'prototype'>;
declare class ScopeContextError extends Error {
}
declare const scoped: <ClassType extends new (...args: any[]) => any>(ClassCtor: ClassType) => ScopedClassTypeActivator<ConstructorParameters<ClassType>, ClassType> & IScopedClassRun<ConstructorParameters<ClassType>>;

export { type IScopedClassRun, type IScopedClassType, ScopeContextError, type ScopedClassTypeActivator, scoped };
