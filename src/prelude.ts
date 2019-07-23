export function id<T>(t: T): T {
    return t;
}

export function constant<T1, T2>(t: T1): (_: T2) => T1 {
    return _ => t;
}

export function pipe<A extends Array<unknown>, B>(
    f: (...a: A) => B): (...a: A) => B;

export function pipe<A extends Array<unknown>, B, C>(
    f: (...a: A) => B,
    g: (b: B) => C): (...a: A) => C;

export function pipe<A extends Array<unknown>, B, C, D>(
    f: (...a: A) => B,
    g: (b: B) => C,
    h: (c: C) => D): (...a: A) => D;

export function pipe<A extends Array<unknown>, B, C, D, E>(
    f: (...a: A) => B,
    g: (b: B) => C,
    h: (c: C) => D,
    i: (d: D) => E): (...a: A) => E;

export function pipe<A extends Array<unknown>, B, C, D, E, F>(
    f: (...a: A) => B,
    g: (b: B) => C,
    h: (c: C) => D,
    i: (d: D) => E,
    j: (e: E) => F): (...a: A) => F;

export function pipe<A extends Array<unknown>, B, C, D, E, F, G>(
    f: (...a: A) => B,
    g: (b: B) => C,
    h: (c: C) => D,
    i: (d: D) => E,
    j: (e: E) => F,
    k: (f: F) => G): (...a: A) => G;

export function pipe<A extends Array<unknown>, B, C, D, E, F, G, H>(
    f: (...a: A) => B,
    g: (b: B) => C,
    h: (c: C) => D,
    i: (d: D) => E,
    j: (e: E) => F,
    k: (f: F) => G,
    l: (g: G) => H): (...a: A) => H;

export function pipe<A extends Array<unknown>, B, C, D, E, F, G, H, I>(
    f: (...a: A) => B,
    g: (b: B) => C,
    h: (c: C) => D,
    i: (d: D) => E,
    j: (e: E) => F,
    k: (f: F) => G,
    l: (g: G) => H,
    m: (h: H) => I): (...a: A) => I;

export function pipe<A extends Array<unknown>, B, C, D, E, F, G, H, I, J>(
    f: (...a: A) => B,
    g: (b: B) => C,
    h: (c: C) => D,
    i: (d: D) => E,
    j: (e: E) => F,
    k: (f: F) => G,
    l: (g: G) => H,
    m: (h: H) => I,
    n: (i: I) => J): (...a: A) => J;

export function pipe(
    f: Function,
    g?: Function,
    h?: Function,
    i?: Function,
    j?: Function,
    k?: Function,
    l?: Function,
    m?: Function,
    n?: Function): unknown
{
    switch (arguments.length) {
      case 1:
        return f
      case 2:
        return function(this: unknown) {
          return g!(f.apply(this, arguments))
        }
      case 3:
        return function(this: unknown) {
          return h!(g!(f.apply(this, arguments)))
        }
      case 4:
        return function(this: unknown) {
          return i!(h!(g!(f.apply(this, arguments))))
        }
      case 5:
        return function(this: unknown) {
          return j!(i!(h!(g!(f.apply(this, arguments)))))
        }
      case 6:
        return function(this: unknown) {
          return k!(j!(i!(h!(g!(f.apply(this, arguments))))))
        }
      case 7:
        return function(this: unknown) {
          return l!(k!(j!(i!(h!(g!(f.apply(this, arguments)))))))
        }
      case 8:
        return function(this: unknown) {
          return m!(l!(k!(j!(i!(h!(g!(f.apply(this, arguments))))))))
        }
      case 9:
        return function(this: unknown) {
          return n!(m!(l!(k!(j!(i!(h!(g!(f.apply(this, arguments)))))))))
        }
    }
}