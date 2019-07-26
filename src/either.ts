import {unzip, zipWith} from "./array";
import {id, objectToEntries, objectFromEntries, constant} from "./prelude";

/*
 * Data Types
 */
export interface IEither<A, B> {
    readonly defaultLeftWith: (a: A) => A,
    readonly defaultRightWith: (b: B) => B,
    readonly flatMap: <C>(f: (b: B) => Either<A, C>) => Either<A, C>,
    readonly map: <C>(f: (b: B) => C) => Either<A, C>,
    readonly mapLeft: <C>(f: (a: A) => C) => Either<C, B>,
    readonly matchCase: <C>(cases: EitherCaseScrutinizer<A, B, C>) => C,
    readonly or: (other: () => Either<A, B>) => Either<A, B>,
    readonly replace: <C>(m: Either<A, C>) => Either<A, C>,
    readonly replacePure: <C>(c: C) => Either<A, C>,
    readonly voidOut: () => Either<A, []>
}

type EitherCaseScrutinizer<A, B, C> = {
    left: (a: A) => C,
    right: (b: B) => C
}
type EitherLeft<A> = { tag: "Left", value: A };
type EitherRight<B> = { tag: "Right",  value: B };
export type Either<A, B> = (EitherLeft<A> | EitherRight<B>) & IEither<A, B>;
export type MapEither<A, B> = { [K in keyof B]: Either<A, B[K]> };



/*
 * Constructors
 */

export function Left<A, B>(value: A): Either<A, B> {
    return <Either<A, B>>Object.freeze({ 
        tag: "Left",
        value,
        defaultLeftWith: constant(value),
        defaultRightWith: id,
        flatMap: _ => Left<A, B>(value),
        map: _ => Left(value),
        mapLeft: f => Left(f(value)),
        matchCase: ({left}) => left(value),
        or: x => x(),
        replace: _ => Left(value),
        replacePure: _ => Left(value),
        toString: () => `Left (${value})`,
        voidOut: () => Left<A, []>(value)
    });
}

export function Right<A, B>(value: B) : Either<A, B> {
    return <Either<A, B>>Object.freeze({
        tag: "Right",
        value,
        defaultLeftWith: id,
        defaultRightWith: constant(value),
        flatMap: f => f(value),
        map: f => Right(f(value)),
        mapLeft: _ => Right(value),
        matchCase: ({right}) => right(value),
        or: _ => Right(value),
        replace: id,
        replacePure: Right,
        toString: () => `Right (${value})`,
        voidOut: () => Right<A, []>([])
    });
}



/*
 * Either Functions
 */

export function lefts<A, B>(es: Either<A, B>[]): A[] {
    return es.reduce(
        (state, m) => [...state, ...m.matchCase({left: x => [x], right: () => []})],
        <A[]>[]);
}

export function rights<A, B>(es: Either<A, B>[]): B[] {
    return es.reduce(
        (state, m) => [...state, ...m.matchCase({left: () => [], right: x => [x]})],
        <B[]>[]);
}

export function isLeft<A, B>(m:Either<A, B>) : m is EitherLeft<A> & IEither<A, B> {
    return m.tag === "Left";
}

export function isRight<A, B>(m:Either<A, B>) : m is EitherRight<B> & IEither<A, B> {
    return m.tag === "Right";
}



/*
 * General lifting functions.
 */

export function liftF<A, P extends any[], R>(f: (...args: P) => R, ...args: MapEither<A, P>): Either<A, R> {
    const errors = lefts(args);

    return errors.length === 0
        ? Right(f.apply(undefined, <P>rights(args)))
        : Left(errors[0]);
}

export function liftO<A, T>(spec: MapEither<A, T>): Either<A, T> {
    const maybeKvps = sequence(objectToEntries(spec).map(
        ([key, value]) => value.map(x => <[keyof T, T[typeof key]]>[key, x])));

    return maybeKvps.map(objectFromEntries);
}



/*
 * Kliesli composition functions
 */

export function mapM<A, B, C>(f: (value: B) => Either<A, C>, bs: B[]): Either<A, C[]> {
    return bs.reduce(
        (mcs, b) => liftF((cs, c) => [...cs, c], mcs, f(b)),
        Right<A, C[]>([]));
}

export function forM<A, B, C>(bs: B[], f: (value: B) => Either<A, C>): Either<A, C[]> {
    return mapM(f, bs);
}

export function sequence<A, B>(bs: Either<A, B>[]): Either<A, B[]> {
    return mapM(id, bs);
}

export function mapAndUnzipWith<A, B, C, D>(f: (a: B) => Either<A, [C, D]>, bs: B[]): Either<A, [C[], D[]]> {
    return mapM(f, bs).map(unzip);
}

export function zipWithM<A, B, C, D>(f: (b: B, c: C) => Either<A, D>, bs: B[], cs: C[]): Either<A, D[]> {
    return sequence(zipWith(f, bs, cs));
}

export function reduceM<A, B, C>(f: (state: C, b: B) => Either<A, C>, seed: C, bs: B[]): Either<A, C> {
    return bs.reduce(
        (state, a) => state.flatMap(b => f(b, a)),
        Right<A, C>(seed));
}



/*
 * General monad functions
 */

export function join<A, B>(m: Either<A, Either<A, B>>): Either<A, B> {
    return m.flatMap(id);
}

export function when<A>(b: boolean, e: Either<A, []>): Either<A, []> {
    return b ? e : Right([]);
}

export function unless<A>(b: boolean, e: Either<A, []>): Either<A, []> {
    return when(!b, e);
}