import {unzip, zipWith} from "./array";
import {constant, id} from "./prelude";

type MaybeCaseScrutinizer<A, B> = {
    just: (a: A) => B,
    nothing: () => B
}

export interface IMaybe<A> {
    readonly defaultWith: (a: A) => A,
    readonly filter: (p: (a: A) => boolean) => Maybe<A>,
    readonly flatMap: <B>(f: (a: A) => Maybe<B>) => Maybe<B>,
    readonly map: <B>(f: (a: A) => B) => Maybe<B>,
    readonly matchCase: <B>(cases: MaybeCaseScrutinizer<A, B>) => B,
    readonly or: (other: () => Maybe<A>) => Maybe<A>,
    readonly replace: <B>(m: Maybe<B>) => Maybe<B>,
    readonly replacePure: <B>(b: B) => Maybe<B>,
    readonly toArray: () => A[],
    readonly voidOut: () => Maybe<[]>
}

type MaybeJust<A> = { tag: "Just"; value: A };
type MaybeNothing = { tag: "Nothing" };
export type Maybe<A> = (MaybeJust<A> | MaybeNothing) & IMaybe<A>;

export function Just<A>(value: A): Maybe<A> {
    return Object.freeze({ 
        tag: "Just",
        value,
        defaultWith: constant(value),
        filter: p => p(value) ? Just(value) : Nothing(),
        flatMap: f => f(value),
        map: f => Just(f(value)),
        matchCase: ({just}) => just(value),
        or: constant(Just(value)),
        replace: id,
        replacePure: Just,
        toArray: () => [value],
        voidOut: () => Just(<[]>[])
    });
}

export function Nothing<A>() : Maybe<A> {
    return Object.freeze({
        tag: "Nothing",
        defaultWith: id,
        filter: constant(Nothing()),
        flatMap: constant(Nothing()),
        map: constant(Nothing()),
        matchCase: ({nothing}) => nothing(),
        or: m2 => m2(),
        replace: constant(Nothing()),
        replacePure: constant(Nothing()),
        toArray: () => [],
        voidOut: () => Nothing<[]>()
    });
}

export function toMaybe<A>(value?: A): Maybe<A> {
    return value === undefined || value === null ? Nothing() : Just(value);
}

export function isJust<A>(m:Maybe<A>) : m is MaybeJust<A> & IMaybe<A> {
    return m.tag === "Just";
}

export function isNothing<A>(m:Maybe<A>) : m is MaybeNothing & IMaybe<A> {
    return m.tag === "Nothing";
}

export function arrayToMaybe<A>(ts: A[]) : Maybe<A> {
    return ts.length === 0 ? Nothing() : Just(ts[0]);
}

export function mapMaybe<A, B>(f: (value: A) => Maybe<B>, ms: A[]): B[] {
    return ms
        .map(f)
        .reduce(
            (state, b) => {
                switch (b.tag) {
                    case "Just": return [...state, b.value];
                    case "Nothing": return state;
                }
            },
            <B[]>[]);
}

export function catMaybes<A>(ms: Maybe<A>[]): A[] {
    return ms.reduce(
        (state, m) => {
            switch (m.tag) {
                case "Just": return [...state, m.value];
                case "Nothing": return state;
            }
        },
        <A[]>[]);
}

export function pure<A>(value: A): Maybe<A> {
    return Just(value);
}

export function apply<A, B>(f: Maybe<(a: A) => B>, m: Maybe<A>): Maybe<B> {
    switch (f.tag) {
        case "Nothing": return Nothing();
        case "Just":
            switch (m.tag) {
                case "Nothing": return Nothing();
                case "Just": return Just(f.value(m.value));
                default: return m;
            }
    }
}

export function empty<A>(): Maybe<A> {
    return Nothing();
}

export function lift2<A, B, C>(f: (a: A, b: B) => C): (a: Maybe<A>, b: Maybe<B>) => Maybe<C> {
    const fcurried = (a: A) => (b: B) => f(a, b);
    return (e1, e2) => apply(e1.map(fcurried), e2);
}

export function lift3<A, B, C, D>(f: (a: A, b: B, c: C) => D): (a: Maybe<A>, b: Maybe<B>, c: Maybe<C>) => Maybe<D> {
    const fcurried = (a: A) => (b: B) => (c: C) => f(a, b, c);
    return (e1, e2, e3) => apply(apply(e1.map(fcurried), e2), e3);
}

export function lift4<A, B, C, D, E>(f: (a: A, b: B, c: C, d: D) => E): (a: Maybe<A>, b: Maybe<B>, c: Maybe<C>, d: Maybe<D>) => Maybe<E> {
    const fcurried = (a: A) => (b: B) => (c: C) => (d: D) => f(a, b, c, d);
    return (e1, e2, e3, e4) => apply(apply(apply(e1.map(fcurried), e2), e3), e4);
}

export function mapM<A, B>(f: (value: A) => Maybe<B>, as: A[]): Maybe<B[]> {
    return as.reduce(
        (mbs, a) => lift2((bs: B[], b: B) => [...bs, b])(mbs, f(a)),
        pure(<B[]>[]));
}

export function mapM_<A, B>(f: (value: A) => Maybe<B>, as: A[]): Maybe<[]> {
    return mapM(f, as).voidOut();
}

export function forM<A, B>(as: A[], f: (value: A) => Maybe<B>): Maybe<B[]> {
    return as.reduce(
        (mbs, a) => lift2((bs: B[], b: B) => [...bs, b])(mbs, f(a)),
        pure(<B[]>[]));
}

export function forM_<A, B>(as: A[], f: (value: A) => Maybe<B>): Maybe<[]> {
    return forM(as, f).voidOut();
}

export function sequence<A>(mas: Maybe<A>[]): Maybe<A[]> {
    return mas.reduce(
        (mbs, ma) => lift2((as: A[], a: A) => [...as, a])(mbs, ma),
        pure(<A[]>[]));
}

export function sequence_<A>(as: Maybe<A>[]): Maybe<[]> {
    return sequence(as).voidOut();
}

export function join<A>(m: Maybe<Maybe<A>>): Maybe<A> {
    return m.flatMap(id);
}

export function mapAndUnzipWith<A, B, C>(f: (a: A) => Maybe<[B, C]>, as: A[]): Maybe<[B[], C[]]> {
    return mapM(f, as).map(unzip);
}

export function zipWithM<A, B, C>(f: (a: A, b: B) => Maybe<C>, as: A[], bs: B[]): Maybe<C[]> {
    return sequence(zipWith(f, as, bs));
}

export function zipWithM_<A, B, C>(f: (a: A, b: B) => Maybe<C>, as: A[], bs: B[]): Maybe<[]> {
    return zipWithM(f, as, bs).voidOut();
}

export function reduceM<A, B>(f: (state: B, a: A) => Maybe<B>, seed: B, as: A[]): Maybe<B> {
    return as.reduce(
        (state, a) => state.flatMap(b => f(b, a)),
        pure(seed));
}

export function reduceM_<A, B>(f: (state: B, a: A) => Maybe<B>, seed: B, as: A[]): Maybe<[]> {
    return reduceM(f, seed, as).voidOut();
}

export function replicate<A>(n: number, m: Maybe<A>): Maybe<A[]> {
    const arr = [];
    for (let i = 0; i < n; ++i) {
        arr.push(m);
    }
    return sequence(arr);
}

export function replicate_<A>(n: number, m: Maybe<A>): Maybe<[]> {
    return replicate(n, m).voidOut();
}

export function when(b: boolean): Maybe<[]> {
    return b ? pure([]) : empty();
}

export function unless(b: boolean): Maybe<[]> {
    return when(!b);
}
