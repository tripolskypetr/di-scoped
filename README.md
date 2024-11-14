# di-scoped

> A context-based instantiation system using `async_hooks`, ensuring each class instance is scoped to a unique execution context, with automatic creation and reuse of different instances using the same reference across multiple contexts.

This works the same like [Scoped ASP.Net Core services](https://henriquesd.medium.com/dependency-injection-and-service-lifetimes-in-net-core-ab9189349420), aka `These services are created once per HTTP request and are tied to the lifetime of the request (i.e., the HttpContext).`

## The Context Scoped services for NodeJS

1. **The constructor arguments are moved to the context creation scope**

```tsx
// TypeScript

import { scoped } from 'di-scoped';

const TestClass = scoped(class {

    constructor(private name: string) {
    }

    test() {
        console.log(`Hello, ${this.name}`);
    }
});


TestClass.runInContext(() => {
    new TestClass().test(); // Hello, Peter
}, "Peter")

new TestClass().test(); // ScopeContextError('di-scoped ContextReferer not running in context');
```

2. **The instance reference is similar independent to the context**

```tsx
// TypeScript

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
    //          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
}
```
