import {unzip, zipWith} from "./array";
import {id, objectToEntries, objectFromEntries, constant} from "./prelude";
import { Maybe, Nothing, Just } from "./maybe";

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
    return sequence(args).map(a => f.apply(undefined, <P>a));
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
        (mcs, b) => mcs.flatMap(cs => f(b).map(c => [...cs, c])),
        Right<A, C[]>([]));
}

export function forM<A, B, C>(bs: B[], f: (value: B) => Either<A, C>): Either<A, C[]> {
    return bs.reduce(
        (mcs, b) => mcs.flatMap(cs => f(b).map(c => [...cs, c])),
        Right<A, C[]>([]));
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



/*
 * Decoders
 */

export type DecodeError = [string, string];

export function date(value: any): Either<DecodeError, Date> {
    if (value instanceof Date) {
        return Right(value);
    } else {
        const parsed = Date.parse(value);
        return parsed === NaN
            ? Left(["$", "Expected a date"])
            : Right(new Date(parsed));
    }
}

function prefixError(prefix: string, [childError, message]: DecodeError): DecodeError {
    const suffix = childError === "$"
        ? ""
        : childError.startsWith("[")
            ? childError
            : `.${childError}`;

    return [`${prefix}${suffix}`, message]
}

export function array<T>(convert: (_: any) => Either<DecodeError, T>, value: any): Either<DecodeError, T[]> {
    return Array.isArray(value)
        ? sequence(value.map((x, i) => convert(x).mapLeft(error => prefixError(`[${i}]`, error))))
        : Left(["$", "Expected an array"]);
}

export function oneOf<T>(value: any, ...choices: T[]): Either<DecodeError, T> {
    const found = choices.find(x => x === value);
    return found
        ? Right(found)
        : Left(choices.length === 0
            ? ["$", "There are no valid options to choose from"]
            : ["$", `Valid options: ${choices.map(x => `"${x}"`).join(", ")}`]);
}

export function number(value: any): Either<DecodeError, number> {
    return typeof(value) === "number" ? Right(value) : Left(["$", "Expected a number"]);
}

export function optional<T>(convert: (_: any) => Either<DecodeError, T>, value: any): Either<DecodeError, Maybe<T>> {
    return value === null || value === undefined ? Right(Nothing()) : convert(value).map(Just);
}

export function object<T extends object>(convert: (_: object) => Either<DecodeError, T>, value: any): Either<DecodeError, T> {
    return typeof(value) === "object" && value !== null ? convert(value) : Left(["$", "Expected an object"]);
}

export function property<T>(
    obj: object,
    name: string,
    convert: (_: any) => Either<DecodeError, T>): Either<DecodeError, T> {
    return obj.hasOwnProperty(name)
        ? convert((<any>obj)[name]).mapLeft(error => prefixError(name, error))
        : Left([name, "Required"]);
}

export function string(value: any): Either<DecodeError, string> {
    return typeof(value) === "string" ? Right(value) : Left(["$", "Expected a string"]);
}

export function tuple<T extends any[]>(value: any, ...converters: { [K in keyof T]: (_: any) => Either<DecodeError, T[K]> }): Either<DecodeError, T> {
    return Array.isArray(value)
        ? value.length === converters.length
            ? <Either<DecodeError, T>><unknown>zipWithM(
                (x, [converter, i]) => converter(x).mapLeft(error => prefixError(`[${i}]`, error)),
                value,
                converters.map((x, i) => <[(_: any) => Either<DecodeError, T[keyof T]>, number]>[x, i]))
            : Left(["$", `Expected an array of length ${converters.length}`])
        : Left(["$", `Expected an array of length ${converters.length}`]);
}