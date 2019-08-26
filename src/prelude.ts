import { Curry, Equals } from "./utilityTypes";

export {
    Case,
    Gadt,
    MultiParamGadt,
    absurd,
    constant,
    curry,
    gadt,
    id,
    objectFromEntries,
    objectToEntries,
    pipe,
    pipeWith,
    prove,
    proveNever,
    simplify,
};

// tslint:disable: ban-types
interface Case<Tag extends string> {
    __case: Tag;
}

interface Gadt<TCase, T> {
    toGeneric(tcase: TCase): T;
    fromGeneric(t: T): TCase;
}

interface MultiParamGadt<Ts extends Array<[any, any]>> {
    toGeneric<I extends keyof Ts & number = 0>(tCase: Ts[I][0]): Ts[I][1];
    fromGeneric<I extends keyof Ts & number = 0>(t: Ts[I][1]): Ts[I][0];
}

function gadt<TObject, TCase, T>(spec: TObject): TObject & Gadt<TCase, T> {
    return {
        ...spec,
        fromGeneric: (x) => x as Equals<T, TCase>,
        toGeneric: (x) => x as Equals<TCase, T>,
    };
}

function multiParamGadt<TObject, Ts extends Array<[any, any]>(spec: TObject): TObject & MultiParamGadt<Ts> {
    return {
        ...spec,
        fromGeneric: id,
        toGeneric: id,
    };
}

/**
 * A function which can never be called. Can be useful for
 * demonstrating absurd or impossible scenarios to the compiler.
 */
function absurd<T>(_: never): T {
    throw new Error("absurd");
}

/**
 * Proves a proposition of type equality.
 */
function prove<A extends Equals<any, any>>(witness: A) { return; }

/**
 * Proves a type is never.
 */
function proveNever<A extends never>() {
    return;
}

/**
 * A function which returns its parameter unchanged.
 */
function id<T>(t: T): T {
    return t;
}

/**
 * Builds a function that always returns the initially
 * supplied value no matter what.
 */
function constant<T1, T2>(t: T1): (_: T2) => T1 {
    return (_) => t;
}

function pipe<A, B>(
    f: (a: A) => B): (a: A) => B;

function pipe<A, B, C>(
    f: (a: A) => B,
    g: (b: B) => C): (a: A) => C;

function pipe<A, B, C, D>(
    f: (a: A) => B,
    g: (b: B) => C,
    h: (c: C) => D): (a: A) => D;

function pipe<A, B, C, D, E>(
    f: (a: A) => B,
    g: (b: B) => C,
    h: (c: C) => D,
    i: (d: D) => E): (a: A) => E;

function pipe<A, B, C, D, E, F>(
    f: (a: A) => B,
    g: (b: B) => C,
    h: (c: C) => D,
    i: (d: D) => E,
    j: (e: E) => F): (a: A) => F;

function pipe<A, B, C, D, E, F, G>(
    f: (a: A) => B,
    g: (b: B) => C,
    h: (c: C) => D,
    i: (d: D) => E,
    j: (e: E) => F,
    k: (f: F) => G): (a: A) => G;

function pipe<A, B, C, D, E, F, G, H>(
    f: (a: A) => B,
    g: (b: B) => C,
    h: (c: C) => D,
    i: (d: D) => E,
    j: (e: E) => F,
    k: (f: F) => G,
    l: (g: G) => H): (a: A) => H;

function pipe<A, B, C, D, E, F, G, H, I>(
    f: (a: A) => B,
    g: (b: B) => C,
    h: (c: C) => D,
    i: (d: D) => E,
    j: (e: E) => F,
    k: (f: F) => G,
    l: (g: G) => H,
    m: (h: H) => I): (a: A) => I;

function pipe<A, B, C, D, E, F, G, H, I, J>(
    f: (a: A) => B,
    g: (b: B) => C,
    h: (c: C) => D,
    i: (d: D) => E,
    j: (e: E) => F,
    k: (f: F) => G,
    l: (g: G) => H,
    m: (h: H) => I,
    n: (i: I) => J): (a: A) => J;

/**
 * Compose functions left-to-right.
 *
 * ```ts
 * const f = pipe(Math.sqrt, n => n * 2, n => n.toString());
 * f(9); // "6"
 * ```
 */
function pipe(
    f: Function,
    g?: Function,
    h?: Function,
    i?: Function,
    j?: Function,
    k?: Function,
    l?: Function,
    m?: Function,
    n?: Function): unknown {
    switch (arguments.length) {
        case 1:
            return f;
        case 2:
            return function(this: unknown) {
                return g!(f.apply(this, arguments));
            };
        case 3:
            return function(this: unknown) {
                return h!(g!(f.apply(this, arguments)));
            };
        case 4:
            return function(this: unknown) {
                return i!(h!(g!(f.apply(this, arguments))));
            };
        case 5:
            return function(this: unknown) {
                return j!(i!(h!(g!(f.apply(this, arguments)))));
            };
        case 6:
            return function(this: unknown) {
                return k!(j!(i!(h!(g!(f.apply(this, arguments))))));
            };
        case 7:
            return function(this: unknown) {
                return l!(k!(j!(i!(h!(g!(f.apply(this, arguments)))))));
            };
        case 8:
            return function(this: unknown) {
                return m!(l!(k!(j!(i!(h!(g!(f.apply(this, arguments))))))));
            };
        case 9:
            return function(this: unknown) {
                return n!(m!(l!(k!(j!(i!(h!(g!(f.apply(this, arguments)))))))));
            };
    }
}

function pipeWith<A, B>(
    a: A,
    f: (a: A) => B): B;

function pipeWith<A, B, C>(
    a: A,
    f: (a: A) => B,
    g: (b: B) => C): C;

function pipeWith<A, B, C, D>(
    a: A,
    f: (a: A) => B,
    g: (b: B) => C,
    h: (c: C) => D): D;

function pipeWith<A, B, C, D, E>(
    a: A,
    f: (a: A) => B,
    g: (b: B) => C,
    h: (c: C) => D,
    i: (d: D) => E): E;

function pipeWith<A, B, C, D, E, F>(
    a: A,
    f: (a: A) => B,
    g: (b: B) => C,
    h: (c: C) => D,
    i: (d: D) => E,
    j: (e: E) => F): F;

function pipeWith<A, B, C, D, E, F, G>(
    a: A,
    f: (a: A) => B,
    g: (b: B) => C,
    h: (c: C) => D,
    i: (d: D) => E,
    j: (e: E) => F,
    k: (f: F) => G): G;

function pipeWith<A, B, C, D, E, F, G, H>(
    a: A,
    f: (a: A) => B,
    g: (b: B) => C,
    h: (c: C) => D,
    i: (d: D) => E,
    j: (e: E) => F,
    k: (f: F) => G,
    l: (g: G) => H): H;

function pipeWith<A, B, C, D, E, F, G, H, I>(
    a: A,
    f: (a: A) => B,
    g: (b: B) => C,
    h: (c: C) => D,
    i: (d: D) => E,
    j: (e: E) => F,
    k: (f: F) => G,
    l: (g: G) => H,
    m: (h: H) => I): I;

function pipeWith<A, B, C, D, E, F, G, H, I, J>(
    a: A,
    f: (a: A) => B,
    g: (b: B) => C,
    h: (c: C) => D,
    i: (d: D) => E,
    j: (e: E) => F,
    k: (f: F) => G,
    l: (g: G) => H,
    m: (h: H) => I,
    n: (i: I) => J): J;

/**
 * Compose functions left-to-right and supply an initial value.
 *
 * ```ts
 * pipe(6, Math.sqrt, n => n * 2, n => n.toString()); // "6"
 * ```
 */
function pipeWith(
    a: unknown,
    f: Function,
    g?: Function,
    h?: Function,
    i?: Function,
    j?: Function,
    k?: Function,
    l?: Function,
    m?: Function,
    n?: Function): unknown {
    switch (arguments.length - 1) {
        case 1:
            return f(a);
        case 2:
            return g!(f.apply(undefined, arguments));
        case 3:
            return h!(g!(f.apply(undefined, arguments)));
        case 4:
            return i!(h!(g!(f.apply(undefined, arguments))));
        case 5:
            return j!(i!(h!(g!(f.apply(undefined, arguments)))));
        case 6:
            return k!(j!(i!(h!(g!(f.apply(undefined, arguments))))));
        case 7:
            return l!(k!(j!(i!(h!(g!(f.apply(undefined, arguments)))))));
        case 8:
            return m!(l!(k!(j!(i!(h!(g!(f.apply(undefined, arguments))))))));
        case 9:
            return n!(m!(l!(k!(j!(i!(h!(g!(f.apply(undefined, arguments)))))))));
    }
}

/**
 * Take any function and produced a curried version.
 *
 * ```ts
 * f : (a: number, b: boolean, c: string) => string;
 * curry(f); // (a: number) => (b: boolean) => (c: string) => string;
 * f(1)(false)("foo");
 * ```
 */
function curry<P extends any[], R>(f: (...args: P) => R): Curry<P, R> {
    return curryImpl(f, f.length) as unknown as Curry<P, R>;
}

// tslint:disable-next-line: ban-types
function curryImpl(f: Function, arity: number): Function {
    return arity === 1
        ? f
        : (x: any) => curryImpl((...args: any[]) => f(x, ...args), arity - 1);
}

/**
 * Convert an object to an array of key-value pairs.
 */
function objectToEntries<T extends object>(value: T): Array<[keyof T, T[keyof T]]> {
    const entries: Array<[keyof T, T[keyof T]]> = [];
    for (const key in value) {
        if (value.hasOwnProperty(key)) {
            entries.push([key, value[key]]);
        }
    }
    return entries;
}

/**
 * Convert an array of key-value pairs to an object.
 */
function objectFromEntries<T extends object>(entries: Array<[keyof T, T[keyof T]]>): T {
    const result = {} as T;
    for (const [key, value] of entries) {
        result[key] = value;
    }
    return result;
}

function simplify(x: any): any {
    return JSON.parse(JSON.stringify(x));
}
