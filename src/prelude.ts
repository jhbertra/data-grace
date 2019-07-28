// tslint:disable: ban-types

export function id<T>(t: T): T {
    return t;
}

export function constant<T1, T2>(t: T1): (_: T2) => T1 {
    return (_) => t;
}

export function pipe<A, B>(
    f: (a: A) => B): (a: A) => B;

export function pipe<A, B, C>(
    f: (a: A) => B,
    g: (b: B) => C): (a: A) => C;

export function pipe<A, B, C, D>(
    f: (a: A) => B,
    g: (b: B) => C,
    h: (c: C) => D): (a: A) => D;

export function pipe<A, B, C, D, E>(
    f: (a: A) => B,
    g: (b: B) => C,
    h: (c: C) => D,
    i: (d: D) => E): (a: A) => E;

export function pipe<A, B, C, D, E, F>(
    f: (a: A) => B,
    g: (b: B) => C,
    h: (c: C) => D,
    i: (d: D) => E,
    j: (e: E) => F): (a: A) => F;

export function pipe<A, B, C, D, E, F, G>(
    f: (a: A) => B,
    g: (b: B) => C,
    h: (c: C) => D,
    i: (d: D) => E,
    j: (e: E) => F,
    k: (f: F) => G): (a: A) => G;

export function pipe<A, B, C, D, E, F, G, H>(
    f: (a: A) => B,
    g: (b: B) => C,
    h: (c: C) => D,
    i: (d: D) => E,
    j: (e: E) => F,
    k: (f: F) => G,
    l: (g: G) => H): (a: A) => H;

export function pipe<A, B, C, D, E, F, G, H, I>(
    f: (a: A) => B,
    g: (b: B) => C,
    h: (c: C) => D,
    i: (d: D) => E,
    j: (e: E) => F,
    k: (f: F) => G,
    l: (g: G) => H,
    m: (h: H) => I): (a: A) => I;

export function pipe<A, B, C, D, E, F, G, H, I, J>(
    f: (a: A) => B,
    g: (b: B) => C,
    h: (c: C) => D,
    i: (d: D) => E,
    j: (e: E) => F,
    k: (f: F) => G,
    l: (g: G) => H,
    m: (h: H) => I,
    n: (i: I) => J): (a: A) => J;

export function pipe(
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

export function pipeWith<A, B>(
    a: A,
    f: (a: A) => B): B;

export function pipeWith<A, B, C>(
    a: A,
    f: (a: A) => B,
    g: (b: B) => C): C;

export function pipeWith<A, B, C, D>(
    a: A,
    f: (a: A) => B,
    g: (b: B) => C,
    h: (c: C) => D): D;

export function pipeWith<A, B, C, D, E>(
    a: A,
    f: (a: A) => B,
    g: (b: B) => C,
    h: (c: C) => D,
    i: (d: D) => E): E;

export function pipeWith<A, B, C, D, E, F>(
    a: A,
    f: (a: A) => B,
    g: (b: B) => C,
    h: (c: C) => D,
    i: (d: D) => E,
    j: (e: E) => F): F;

export function pipeWith<A, B, C, D, E, F, G>(
    a: A,
    f: (a: A) => B,
    g: (b: B) => C,
    h: (c: C) => D,
    i: (d: D) => E,
    j: (e: E) => F,
    k: (f: F) => G): G;

export function pipeWith<A, B, C, D, E, F, G, H>(
    a: A,
    f: (a: A) => B,
    g: (b: B) => C,
    h: (c: C) => D,
    i: (d: D) => E,
    j: (e: E) => F,
    k: (f: F) => G,
    l: (g: G) => H): H;

export function pipeWith<A, B, C, D, E, F, G, H, I>(
    a: A,
    f: (a: A) => B,
    g: (b: B) => C,
    h: (c: C) => D,
    i: (d: D) => E,
    j: (e: E) => F,
    k: (f: F) => G,
    l: (g: G) => H,
    m: (h: H) => I): I;

export function pipeWith<A, B, C, D, E, F, G, H, I, J>(
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

export function pipeWith(
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

type Head<T extends any[]> = T extends [any, ...any[]] ? T[0] : never;

type Tail<T extends any[]> =
    ((...t: T) => any) extends ((_: any, ...tail: infer TT) => any) ? TT : never;

type HasTail<T extends any[]> =
    T extends ([] | [any])
        ? false
        : true;

type Curry<P extends any[], R> =
    (arg0: Head<P>) => HasTail<P> extends true
        ? Curry<Tail<P>, R>
        : R;

export function curry<P extends any[], R>(f: (...args: P) => R): Curry<P, R> {
  return curryImpl(f, f.length) as unknown as Curry<P, R>;
}

// tslint:disable-next-line: ban-types
function curryImpl(f: Function, arity: number): Function {
    return arity === 1
      ? f
      : (x: any) => curryImpl((...args: any[]) => f(x, ...args), arity - 1);
}

export function objectToEntries<T extends object>(value: T): Array<[keyof T, T[keyof T]]> {
    const entries: Array<[keyof T, T[keyof T]]> = [];
    for (const key in value) {
        if (value.hasOwnProperty(key)) {
            entries.push([key, value[key]]);
        }
    }
    return entries;
}

export function objectFromEntries<T extends object>(entries: Array<[keyof T, T[keyof T]]>): T {
    const result =  {} as T;
    entries.forEach(([key, value]) => result[key] = value);
    return result;
}

export function absurd<T>(_: never): T {
    throw new Error("absurd");
}
