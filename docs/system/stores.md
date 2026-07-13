# SolidJS Stores

## What are stores
Stores are a state management primitive that provide a centralized way 
to handle shared data and reduce redundancy.
Stores can manage many data types, including: objects, arrays, strings, and numbers.

## When to use stores
Use stores in the very specific edge case, where you want to store a global state, like you would a static
property, like an image that needs to be accessible everywhere, between functions, hooks, services, components.

If it's possible do not use stores, try a hook or a service instead. Only use it in an edge case.

## How to create a store
1. Create a new file in the `src/stores` folder
2. Name it after the store, with this pattern: `{STORES_NAME}.store.ts`
3. Create the store inside as a const
4. Export both accessor and getter

Example:
```ts
const [buttonImageStore, setButtonImageStore] = createStore<string>('');

export { buttonImageStore, setButtonImageStore };
```

### Naming
Naming practices
- Main part of the name should always represent its usage
- Give it the suffix store, to make it understandable that it is a store
- The accessor doesn't have a prefix, but the setter does have the `set` prefix
- Use camel-case when naming both the accessor and the setter part

For example:
```ts
const [buttonImageStore, setButtonImageStore] = createStore(/* VALUE */);
```

## How to access a store

When accessing a stores value always wrap it inside the `unwrap()` SolidJS function.

Example:
```ts
const image = unwrap(buttonImageStore);
```