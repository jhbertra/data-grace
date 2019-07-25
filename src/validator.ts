import {unzip, zipWith} from "./array";
import {id, objectToEntries, objectFromEntries, constant} from "./prelude";
import { Maybe, Nothing, Just } from "./maybe";
import { Either, Right, Left } from "./either";

/*
 * Data Types
 */
export interface IValidator<A, B> {
    readonly defaultWith: (b: B) => B,
    readonly map: <C>(f: (b: B) => C) => Validator<A, C>,
    readonly mapErrors: <C>(f: (a: A) => C) => Validator<C, B>,
    readonly matchCase: <C>(cases: ValidatorCaseScrutinizer<A, B, C>) => C,
    readonly or: (other: () => Validator<A, B>) => Validator<A, B>,
    readonly replace: <C>(m: Validator<A, C>) => Validator<A, C>,
    readonly replacePure: <C>(c: C) => Validator<A, C>,
    readonly toEither: () => Either<A[], B>,
    readonly toString: () => string
    readonly voidOut: () => Validator<A, []>
}

type ValidatorCaseScrutinizer<A, B, C> = {
    invalid: (a: A[]) => C,
    valid: (b: B) => C
}
type ValidatorInvalid<A> = { tag: "Invalid", failures: A[] };
type ValidatorValid<B> = { tag: "Valid",  value: B };
export type Validator<A, B> = (ValidatorInvalid<A> | ValidatorValid<B>) & IValidator<A, B>;
export type MapValidator<A, B> = { [K in keyof B]: Validator<A, B[K]> };



/*
 * Constructors
 */

export function Valid<A, B>(value: B) : Validator<A, B> {
    return <Validator<A, B>>Object.freeze({
        tag: "Valid",
        value,
        defaultWith: constant(value),
        map: f => Valid(f(value)),
        mapErrors: _ => Valid(value),
        matchCase: ({valid}) => valid(value),
        or: _ => Valid(value),
        replace: id,
        replacePure: Valid,
        toEither: () => Right<A[], B>(value),
        toString: () => `Valid (${value})`,
        voidOut: () => Valid<A, []>([])
    });
}

export function Invalid<A, B>(failures: A[]): Validator<A, B> {
    return <Validator<A, B>>Object.freeze({ 
        tag: "Invalid",
        failures,
        defaultWith: id,
        map: _ => Invalid(failures),
        mapErrors: f => Invalid(failures.map(f)),
        matchCase: ({invalid}) => invalid(failures),
        or: x => x(),
        replace: _ => Invalid(failures),
        replacePure: _ => Invalid(failures),
        toEither: () => Left<A[], B>(failures),
        toString: () => `Invalid (${failures})`,
        voidOut: () => Invalid<A, []>(failures)
    });
}



/*
 * Validator Functions
 */

export function failures<A, B>(es: Validator<A, B>[]): A[] {
    return es.reduce(
        (state, m) => [...state, ...m.matchCase({invalid: id, valid: () => []})],
        <A[]>[]);
}

export function successful<A, B>(es: Validator<A, B>[]): B[] {
    return es.reduce(
        (state, m) => [...state, ...m.matchCase({invalid: () => [], valid: x => [x]})],
        <B[]>[]);
}

export function isInvalid<A, B>(m:Validator<A, B>) : m is ValidatorInvalid<A> & IValidator<A, B> {
    return m.tag === "Invalid";
}

export function isValid<A, B>(m:Validator<A, B>) : m is ValidatorValid<B> & IValidator<A, B> {
    return m.tag === "Valid";
}



/*
 * General lifting functions.
 */

export function liftF<A, P extends any[], R>(f: (...args: P) => R, ...args: MapValidator<A, P>): Validator<A, R> {
    return sequence(args).map(a => f.apply(undefined, <P>a));
}

export function liftO<A, T>(spec: MapValidator<A, T>): Validator<A, T> {
    const maybeKvps = sequence(objectToEntries(spec).map(
        ([key, value]) => value.map(x => <[keyof T, T[typeof key]]>[key, x])));

    return maybeKvps.map(objectFromEntries);
}



/*
 * Kliesli composition functions
 */

export function mapM<A, B, C>(f: (value: B) => Validator<A, C>, bs: B[]): Validator<A, C[]> {
    var results = bs.map(f);
    var es = failures(results);

    return es.length === 0
        ? Valid(successful(results))
        : Invalid(es);
}

export function forM<A, B, C>(bs: B[], f: (value: B) => Validator<A, C>): Validator<A, C[]> {
    return mapM(f, bs);
}

export function sequence<A, B>(bs: Validator<A, B>[]): Validator<A, B[]> {
    return mapM(id, bs);
}

export function mapAndUnzipWith<A, B, C, D>(f: (a: B) => Validator<A, [C, D]>, bs: B[]): Validator<A, [C[], D[]]> {
    return mapM(f, bs).map(unzip);
}

export function zipWithM<A, B, C, D>(f: (b: B, c: C) => Validator<A, D>, bs: B[], cs: C[]): Validator<A, D[]> {
    return sequence(zipWith(f, bs, cs));
}



/*
 * Decoders
 */

export type DecodeError = [string, string];

export function date(value: any): Validator<DecodeError, Date> {
    if (value instanceof Date) {
        return Valid(value);
    } else {
        const parsed = Date.parse(value);
        return parsed === NaN
            ? Invalid([["$", "Expected a date"]])
            : Valid(new Date(parsed));
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

export function array<T>(convert: (_: any) => Validator<DecodeError, T>, value: any): Validator<DecodeError, T[]> {
    return Array.isArray(value)
        ? sequence(value.map((x, i) => convert(x).mapErrors(error => prefixError(`[${i}]`, error))))
        : Invalid([["$", "Expected an array"]]);
}

export function oneOf<T>(value: any, ...choices: T[]): Validator<DecodeError, T> {
    const found = choices.find(x => x === value);
    return found
        ? Valid(found)
        : Invalid(choices.length === 0
            ? [["$", "There are no valid options to choose from"]]
            : [["$", `Valid options: ${choices.map(x => `"${x}"`).join(", ")}`]]);
}

export function number(value: any): Validator<DecodeError, number> {
    return typeof(value) === "number" ? Valid(value) : Invalid([["$", "Expected a number"]]);
}

export function optional<T>(convert: (_: any) => Validator<DecodeError, T>, value: any): Validator<DecodeError, Maybe<T>> {
    return value === null || value === undefined ? Valid(Nothing()) : convert(value).map(Just);
}

export function object<T extends object>(convert: (_: object) => Validator<DecodeError, T>, value: any): Validator<DecodeError, T> {
    return typeof(value) === "object" && value !== null ? convert(value) : Invalid([["$", "Expected an object"]]);
}

export function property<T>(
    obj: object,
    name: string,
    convert: (_: any) => Validator<DecodeError, T>): Validator<DecodeError, T> {
    return obj.hasOwnProperty(name)
        ? convert((<any>obj)[name]).mapErrors(error => prefixError(name, error))
        : Invalid([[name, "Required"]]);
}

export function string(value: any): Validator<DecodeError, string> {
    return typeof(value) === "string" ? Valid(value) : Invalid([["$", "Expected a string"]]);
}

export function tuple<T extends any[]>(value: any, ...converters: { [K in keyof T]: (_: any) => Validator<DecodeError, T[K]> }): Validator<DecodeError, T> {
    return Array.isArray(value)
        ? value.length === converters.length
            ? <Validator<DecodeError, T>><unknown>zipWithM(
                (x, [converter, i]) => converter(x).mapErrors(error => prefixError(`[${i}]`, error)),
                value,
                converters.map((x, i) => <[(_: any) => Validator<DecodeError, T[keyof T]>, number]>[x, i]))
            : Invalid([["$", `Expected an array of length ${converters.length}`]])
        : Invalid([["$", `Expected an array of length ${converters.length}`]]);
}