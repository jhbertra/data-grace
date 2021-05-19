# Data Grace

Immutable data types for TypeScript.

Data Grace is a small, simple library for immutable data modelling and functional programming.
It includes two of the most useful primative types for functional domain modelling: `Maybe<A>`
for optional data and `Result<A, E>` for results of computations that may fail. It also includes
a type-safe JSON decoder, inspired by Elm's JSON decoders, a composable form parser, and
augments `Array.prototype` with several additional methods inspired by Haskell's `Data.List`
and .NET's `LINQ`

The goal of the project is to maximize utility and compactness. It is not intended to be a full-blown
typed functional programming library. Readers are encouraged to investigate [fp-ts](https://github.com/gcanti/fp-ts)
for such a library, which is a much more comprehensive collection of FP and category theory primitives.
The tradeoff is size and complexity - data-grace is small and fundamentally utilitarian in its design, and
tries to provide an idiomatically JavaScript API where possible.

Install it via npm or yarn!

```
npm install data-grace
```

```
yarn add data-grace
```
