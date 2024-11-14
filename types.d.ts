interface IClassType<Args extends any[]> {
    new (...args: Args): any;
}
interface IClassRun<Args extends any[]> {
    runInContext<Result = unknown>(callback: () => Result, ...args: Args): Result;
}
type ClassTypeActivator<Args extends any[], ClassType extends IClassType<Args>> = {
    new (): InstanceType<ClassType>;
} & Omit<ClassType, 'prototype'>;
declare class ScopeContextError extends Error {
}
declare const scoped: <Args extends any[], ClassType extends IClassType<Args>>(ClassCtor: ClassType) => ClassTypeActivator<Args, ClassType> & IClassRun<Args>;

export { ScopeContextError, scoped };
