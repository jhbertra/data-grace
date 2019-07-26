import {unzip, zipWith} from "./array";
import {id, objectToEntries, objectFromEntries, constant} from "./prelude";
import { Either, Right, Left } from "./either";

/*
 * Data Types
 */
export interface IValidation<A, B> {
    readonly defaultWith: (b: B) => B,
    readonly map: <C>(f: (b: B) => C) => Validation<A, C>,
    readonly mapErrors: <C>(f: (a: A) => C) => Validation<C, B>,
    readonly matchCase: <C>(cases: ValidationCaseScrutinizer<A, B, C>) => C,
    readonly or: (other: () => Validation<A, B>) => Validation<A, B>,
    readonly replace: <C>(m: Validation<A, C>) => Validation<A, C>,
    readonly replacePure: <C>(c: C) => Validation<A, C>,
    readonly toEither: () => Either<A[], B>,
    readonly toString: () => string
    readonly voidOut: () => Validation<A, []>
}

type ValidationCaseScrutinizer<A, B, C> = {
    invalid: (a: A[]) => C,
    valid: (b: B) => C
}
type ValidationInvalid<A> = { tag: "Invalid", failures: A[] };
type ValidationValid<B> = { tag: "Valid",  value: B };
export type Validation<A, B> = (ValidationInvalid<A> | ValidationValid<B>) & IValidation<A, B>;
export type MapValidation<A, B> = { [K in keyof B]: Validation<A, B[K]> };



/*
 * Constructors
 */

export function Valid<A, B>(value: B) : Validation<A, B> {
    return <Validation<A, B>>Object.freeze({
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

export function Invalid<A, B>(failures: A[]): Validation<A, B> {
    return <Validation<A, B>>Object.freeze({ 
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
 * Validation Functions
 */

export function failures<A, B>(es: Validation<A, B>[]): A[] {
    return es.reduce(
        (state, m) => [...state, ...m.matchCase({invalid: id, valid: () => []})],
        <A[]>[]);
}

export function successful<A, B>(es: Validation<A, B>[]): B[] {
    return es.reduce(
        (state, m) => [...state, ...m.matchCase({invalid: () => [], valid: x => [x]})],
        <B[]>[]);
}

export function isInvalid<A, B>(m:Validation<A, B>) : m is ValidationInvalid<A> & IValidation<A, B> {
    return m.tag === "Invalid";
}

export function isValid<A, B>(m:Validation<A, B>) : m is ValidationValid<B> & IValidation<A, B> {
    return m.tag === "Valid";
}



/*
 * General lifting functions.
 */

export function liftF<A, P extends any[], R>(f: (...args: P) => R, ...args: MapValidation<A, P>): Validation<A, R> {
    const errors = failures(args);

    return errors.length === 0
        ? Valid(f.apply(undefined, <P>successful(args)))
        : Invalid(errors);
}

export function liftO<A, T>(spec: MapValidation<A, T>): Validation<A, T> {
    const maybeKvps = sequence(objectToEntries(spec).map(
        ([key, value]) => value.map(x => <[keyof T, T[typeof key]]>[key, x])));

    return maybeKvps.map(objectFromEntries);
}

export function mapM<A, B, C>(f: (value: B) => Validation<A, C>, bs: B[]): Validation<A, C[]> {
    return bs.reduce(
        (mcs, b) => liftF((cs, c) => [...cs, c], mcs, f(b)),
        Valid<A, C[]>([]));
}

export function forM<A, B, C>(bs: B[], f: (value: B) => Validation<A, C>): Validation<A, C[]> {
    return mapM(f, bs);
}

export function sequence<A, B>(bs: Validation<A, B>[]): Validation<A, B[]> {
    return mapM(id, bs);
}

export function mapAndUnzipWith<A, B, C, D>(f: (a: B) => Validation<A, [C, D]>, bs: B[]): Validation<A, [C[], D[]]> {
    return mapM(f, bs).map(unzip);
}

export function zipWithM<A, B, C, D>(f: (b: B, c: C) => Validation<A, D>, bs: B[], cs: C[]): Validation<A, D[]> {
    return sequence(zipWith(f, bs, cs));
}
