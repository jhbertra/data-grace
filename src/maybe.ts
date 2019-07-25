import {unzip, zipWith} from "./array";
import {id, objectToEntries, objectFromEntries} from "./prelude";

/*
 * Data Types
 */

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
    readonly toString: () => string,
    readonly voidOut: () => Maybe<[]>
}

type MaybeCaseScrutinizer<A, B> = {
    just: (a: A) => B,
    nothing: () => B
}
type MaybeJust<A> = { tag: "Just"; value: A };
type MaybeNothing = { tag: "Nothing" };
export type Maybe<A> = (MaybeJust<A> | MaybeNothing) & IMaybe<A>;
export type MapMaybe<A> = { [K in keyof A]: Maybe<A[K]> };



/*
 * Constructors
 */

export function Just<A>(value: A): Maybe<A> {
    return Object.freeze({ 
        tag: "Just",
        value,
        defaultWith: _ => value,
        filter: p => p(value) ? Just(value) : Nothing(),
        flatMap: f => f(value),
        map: f => Just(f(value)),
        matchCase: ({just}) => just(value),
        or: _ => Just(value),
        replace: id,
        replacePure: Just,
        toArray: () => [value],
        toString: () => `Just (${value})`,
        voidOut: () => Just(<[]>[])
    });
}

export function Nothing<A>() : Maybe<A> {
    return <Maybe<A>>Object.freeze({
        tag: "Nothing",
        defaultWith: id,
        filter: _ => Nothing(),
        flatMap: _ => Nothing(),
        map: _ => Nothing(),
        matchCase: ({nothing}) => nothing(),
        or: m2 => m2(),
        replace: _ => Nothing(),
        replacePure: _ => Nothing(),
        toArray: () => [],
        toString: () => `Nothing`,
        voidOut: () => Nothing<[]>()
    });
}



/*
 * Maybe Functions
 */

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



/*
 * General lifting functions.
 */

export function liftF<P extends any[], R>(f: (...args: P) => R, ...args: MapMaybe<P>): Maybe<R> {
    return sequence(args).map(a => f.apply(undefined, <P>a));
}

export function liftO<T>(spec: MapMaybe<T>): Maybe<T> {
    const maybeKvps = sequence(objectToEntries(spec).map(
        ([key, value]) => value.map(x => <[keyof T, T[typeof key]]>[key, x])));

    return maybeKvps.map(objectFromEntries);
}



/*
 * Kliesli composition functions
 */

export function mapM<A, B>(f: (value: A) => Maybe<B>, as: A[]): Maybe<B[]> {
    return as.reduce(
        (mbs, a) => liftF((bs, b) => [...bs, b], mbs, f(a)),
        Just(<B[]>[]));
}

export function forM<A, B>(as: A[], f: (value: A) => Maybe<B>): Maybe<B[]> {
    return as.reduce(
        (mbs, a) => liftF((bs, b) => [...bs, b], mbs, f(a)),
        Just(<B[]>[]));
}

export function sequence<A>(mas: Maybe<A>[]): Maybe<A[]> {
    return mas.reduce(
        (state, ma) => state.flatMap(as => ma.map(a => [...as, a])),
        Just(<A[]>[]));
}

export function mapAndUnzipWith<A, B, C>(f: (a: A) => Maybe<[B, C]>, as: A[]): Maybe<[B[], C[]]> {
    return mapM(f, as).map(unzip);
}

export function zipWithM<A, B, C>(f: (a: A, b: B) => Maybe<C>, as: A[], bs: B[]): Maybe<C[]> {
    return sequence(zipWith(f, as, bs));
}

export function reduceM<A, B>(f: (state: B, a: A) => Maybe<B>, seed: B, as: A[]): Maybe<B> {
    return as.reduce(
        (state, a) => state.flatMap(b => f(b, a)),
        Just(seed));
}



/*
 * General monad functions
 */

export function when(b: boolean): Maybe<[]> {
    return b ? Just([]) : Nothing();
}

export function unless(b: boolean): Maybe<[]> {
    return when(!b);
}

export function join<A>(m: Maybe<Maybe<A>>): Maybe<A> {
    return m.flatMap(id);
}



/*
 * Decoders
 */

export function date(value: any): Maybe<Date> {
    if (value instanceof Date) {
        return Just(value);
    } else {
        const parsed = Date.parse(value);
        return parsed === NaN
            ? Nothing()
            : Just(new Date(parsed));
    }
}

export function array<T>(convert: (_: any) => Maybe<T>, value: any): Maybe<T[]> {
    return Array.isArray(value) ? sequence(value.map(convert)) : Nothing();
}

export function oneOf<T>(value: any, ...choices: T[]): Maybe<T> {
    return toMaybe(choices.find(x => x === value));
}

export function number(value: any): Maybe<number> {
    return typeof(value) === "number" ? Just(value) : Nothing();
}

export function optional<T>(convert: (_: any) => Maybe<T>, value: any): Maybe<Maybe<T>> {
    return value === null || value === undefined ? Just(Nothing()) : convert(value).map(Just);
}

export function object<T extends object>(convert: (_: any) => Maybe<T>, value: any): Maybe<T> {
    return typeof(value) === "object" && value !== null ? convert(value) : Nothing();
}

export function property<T>(
    obj: object,
    name: string,
    convert: (_: any) => Maybe<T>): Maybe<T> {
    return obj.hasOwnProperty(name)
        ? convert((<any>obj)[name])
        : Nothing();
}

export function string(value: any): Maybe<string> {
    return typeof(value) === "string" ? Just(value) : Nothing();
}

export function tuple<T extends any[]>(value: any, ...converters: { [K in keyof T]: (_: any) => Maybe<T[K]> }): Maybe<T> {
    return Array.isArray(value)
        ? value.length === converters.length
            ? <Maybe<T>><unknown>zipWithM((x, converter) => converter(x), value, converters)
            : Nothing()
        : Nothing();
}