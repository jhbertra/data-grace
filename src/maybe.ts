import {unzip, zipWith} from "./array";
import {constant, id} from "./prelude";

type MaybeJust<A> = { tag: "Just"; value: A };
type MaybeNothing = { tag: "Nothing" };
export type Maybe<A> = MaybeJust<A> | MaybeNothing;

export function Just<A>(value: A): Maybe<A> {
    return { tag: "Just", value };
}

export function Nothing<A>() : Maybe<A> {
    return { tag: "Nothing" };
}

export function toMaybe<A>(value?: A): Maybe<A> {
    return value === undefined || value === null ? Nothing() : Just(value);
}

export function maybe<A, B>(def: B, f: (x: A) => B, m: Maybe<A>) : B {
    switch (m.tag) {
        case "Just": return f(m.value);
        case "Nothing": return def;
    }
}

export function isJust<A>(m:Maybe<A>) : m is MaybeJust<A> {
    return m.tag === "Just";
}

export function isNothing<A>(m:Maybe<A>) : m is MaybeNothing {
    return m.tag === "Nothing";
}

export function fromMaybe<A>(def: A, m:Maybe<A>) : A {
    return maybe(def, id, m);
}

export function arrayToMaybe<A>(ts: A[]) : Maybe<A> {
    return ts.length === 0 ? Nothing() : Just(ts[0]);
}

export function maybeToArray<A>(m: Maybe<A>) : A[] {
    return maybe([], x => [x], m);
}

export function mapMaybe<A, B>(f: (value: A) => Maybe<B>, ms: A[]): B[] {
    return ms.reduce(
        (state, m) => [...state, ...maybeToArray(f(m))],
        []);
}

export function catMaybes<A>(ms: Maybe<A>[]): A[] {
    return mapMaybe(id, ms);
}

export function map<A, B>(f: (a: A) => B, m: Maybe<A>): Maybe<B> {
    switch (m.tag) {
        case "Just": return Just(f(m.value));
        case "Nothing": return m;
    }
}

export function pure<A>(value: A): Maybe<A> {
    return Just(value);
}

export function apply<A, B>(f: Maybe<(a: A) => B>, m: Maybe<A>): Maybe<B> {
    switch (f.tag) {
        case "Nothing": return f;
        case "Just":
            switch (m.tag) {
                case "Nothing": return m;
                case "Just": return pure(f.value(m.value));
            }
    }
}

export function flatMap<A, B>(f: (a: A) => Maybe<B>, m: Maybe<A>): Maybe<B> {
    switch (m.tag) {
        case "Nothing": return m;
        case "Just": return f(m.value);
    }
}

export function or<A>(m1: Maybe<A>, m2: Maybe<A>): Maybe<A> {
    switch (m1.tag) {
        case "Nothing": return m1;
        case "Just": return m2;
    }
}

export function empty<A>(): Maybe<A> {
    return Nothing();
}

export function replacePure<A, B>(m: Maybe<A>, b: B) : Maybe<B> {
    return map(constant(b), m);
}

export function replace<A, B>(m: Maybe<A>, b: Maybe<B>) : Maybe<B> {
    return flatMap(constant(b), m);
}

export function voidOut<A>(m: Maybe<A>) : Maybe<[]> {
    return replacePure(m, []);
}

export function lift2<A, B, C>(f: (a: A, b: B) => C): (a: Maybe<A>, b: Maybe<B>) => Maybe<C> {
    return (e1, e2) => flatMap(a => map(b => f(a, b), e2), e1);
}

export function lift3<A, B, C, D>(f: (a: A, b: B, c: C) => D): (a: Maybe<A>, b: Maybe<B>, c: Maybe<C>) => Maybe<D> {
    return (e1, e2, e3) => flatMap(a => flatMap(b => map(c => f(a, b, c), e3), e2), e1);
}

export function lift4<A, B, C, D, E>(f: (a: A, b: B, c: C, d: D) => E): (a: Maybe<A>, b: Maybe<B>, c: Maybe<C>, d: Maybe<D>) => Maybe<E> {
    return (e1, e2, e3, e4) => flatMap(a => flatMap(b => flatMap(c => map(d => f(a, b, c, d), e4), e3), e2), e1);
}

export function mapM<A, B>(f: (value: A) => Maybe<B>, as: A[]): Maybe<B[]> {
    return as.reduce(
        (mbs, a) => lift2((bs: B[], b: B) => [...bs, b])(mbs, f(a)),
        pure([]));
}

export function mapM_<A, B>(f: (value: A) => Maybe<B>, as: A[]): Maybe<[]> {
    return voidOut(mapM(f, as));
}

export function forM<A, B>(as: A[], f: (value: A) => Maybe<B>): Maybe<B[]> {
    return as.reduce(
        (mbs, a) => flatMap(bs => map(b => [...bs, b], f(a)), mbs),
        pure([]));
}

export function forM_<A, B>(as: A[], f: (value: A) => Maybe<B>): Maybe<[]> {
    return voidOut(forM(as, f));
}

export function sequence<A>(as: Maybe<A>[]): Maybe<A[]> {
    return mapM(id, as);
}

export function sequence_<A>(as: Maybe<A>[]): Maybe<[]> {
    return voidOut(sequence(as));
}

export function join<A>(m: Maybe<Maybe<A>>): Maybe<A> {
    return flatMap(id, m);
}

export function filter<A>(p: (a: A) => boolean, m: Maybe<A>): Maybe<A> {
    return flatMap(a => p(a) ? pure(a) : empty() , m);
}

export function mapAndUnzipWith<A, B, C>(f: (a: A) => Maybe<[B, C]>, as: A[]): Maybe<[B[], C[]]> {
    return map(unzip, mapM(f, as));
}

export function zipWithM<A, B, C>(f: (a: A, b: B) => Maybe<C>, as: A[], bs: B[]): Maybe<C[]> {
    return sequence(zipWith(f, as, bs));
}

export function zipWithM_<A, B, C>(f: (a: A, b: B) => Maybe<C>, as: A[], bs: B[]): Maybe<[]> {
    return voidOut(zipWithM(f, as, bs));
}

export function reduceM<A, B>(f: (state: B, a: A) => Maybe<B>, seed: B, as: A[]): Maybe<B> {
    return as.reduce(
        (state, a) => flatMap(b => f(b, a), state),
        pure(seed));
}

export function reduceM_<A, B>(f: (state: B, a: A) => Maybe<B>, seed: B, as: A[]): Maybe<[]> {
    return voidOut(reduceM(f, seed, as));
}

export function replicate<A>(n: number, m: Maybe<A>): Maybe<A[]> {
    const arr = [];
    for (let i = 0; i < n; ++i) {
        arr.push(m);
    }
    return sequence(arr);
}

export function replicate_<A>(n: number, m: Maybe<A>): Maybe<[]> {
    return voidOut(replicate(n, m));
}

export function when<A>(b: boolean): Maybe<[]> {
    return b ? pure([]) : empty();
}

export function unless<A>(b: boolean): Maybe<[]> {
    return when(!b);
}
