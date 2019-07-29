import {unzip, zipWith} from "./array";
import { Either, Left, Right } from "./either";
import {constant, id, objectFromEntries, objectToEntries} from "./prelude";

/*------------------------------
  DATA TYPES
  ------------------------------*/

export interface IValidation<A extends object, B> {
    readonly defaultWith: (b: B) => B;
    readonly map: <C>(f: (b: B) => C) => Validation<A, C>;
    readonly mapError: <C extends object>(f: (a: A) => C) => Validation<C, B>;
    readonly matchCase: <C>(cases: ValidationCaseScrutinizer<A, B, C>) => C;
    readonly or: (other: () => Validation<A, B>) => Validation<A, B>;
    readonly replace: <C>(m: Validation<A, C>) => Validation<A, C>;
    readonly replacePure: <C>(c: C) => Validation<A, C>;
    readonly toEither: () => Either<A, B>;
    readonly toString: () => string;
    readonly voidOut: () => Validation<A, []>;
}

type ValidationCaseScrutinizer<A extends object, B, C> = {
    invalid: (a: A) => C,
    valid: (b: B) => C,
};
type ValidationInvalid<A extends object> = { tag: "Invalid", failure: A };
type ValidationValid<B> = { tag: "Valid",  value: B };
export type Validation<A extends object, B> = (ValidationInvalid<A> | ValidationValid<B>) & IValidation<A, B>;
export type MapValidation<A extends object, B> = { [K in keyof B]: Validation<A, B[K]> };

/*------------------------------
  CONSTRUCTORS
  ------------------------------*/

export function Valid<A extends object, B>(value: B): Validation<A, B> {
    return  Object.freeze({
        defaultWith: constant(value),
        map: (f) => Valid(f(value)),
        mapError: (_) => Valid(value),
        matchCase: ({valid}) => valid(value),
        or: (_) => Valid(value),
        replace: id,
        replacePure: Valid,
        tag: "Valid",
        toEither: () => Right<A, B>(value),
        toString: () => `Valid (${value})`,
        value,
        voidOut: () => Valid<A, []>([]),
    }) as Validation<A, B>;
}

export function Invalid<A extends object, B>(failure: A): Validation<A, B> {
    return  Object.freeze({
        defaultWith: id,
        failure,
        map: (_) => Invalid(failure),
        mapError: (f) => Invalid(f(failure)),
        matchCase: ({invalid}) => invalid(failure),
        or: (x) => x(),
        replace: (_) => Invalid(failure),
        replacePure: (_) => Invalid(failure),
        tag: "Invalid",
        toEither: () => Left<A, B>(failure),
        toString: () => `Invalid (${failure})`,
        voidOut: () => Invalid<A, []>(failure),
    }) as Validation<A, B>;
}

/*------------------------------
  VALIDATION FUNCTIONS
  ------------------------------*/

export function failures<A extends object, B>(es: Array<Validation<A, B>>): A[] {
    return es.reduce(
        (state, m) => [...state, ...m.matchCase({invalid: (x) => [x], valid: () => []})],
         [] as A[]);
}

export function successful<A extends object, B>(es: Array<Validation<A, B>>): B[] {
    return es.reduce(
        (state, m) => [...state, ...m.matchCase({invalid: () => [], valid: (x) => [x]})],
         [] as B[]);
}

export function isInvalid<A extends object, B>(m: Validation<A, B>): m is ValidationInvalid<A> & IValidation<A, B> {
    return m.tag === "Invalid";
}

export function isValid<A extends object, B>(m: Validation<A, B>): m is ValidationValid<B> & IValidation<A, B> {
    return m.tag === "Valid";
}

/*------------------------------
  GENERAL LIFTING FUNCTIONS
  ------------------------------*/

export function liftF<A extends object, P extends any[], R>(
    f: (...args: P) => R,
    ...args: MapValidation<A, P>): Validation<A, R> {
    const errors = failures(args);

    return errors.length === 0
        ? Valid(f.apply(undefined,  successful(args) as P))
        : Invalid(errors.reduce((a, b) => ({...a, ...b}),  {} as A));
}

export function liftO<A extends object, T extends object>(spec: MapValidation<A, T>): Validation<A, T> {
    const kvpValidation = sequence(objectToEntries(spec).map(
        ([key, value]) => value.map((x) =>  [key, x] as [keyof T, T[typeof key]])));

    return kvpValidation.map(objectFromEntries);
}

/*------------------------------
  KLIESLI COMPOSITION FUNCTIONS
  ------------------------------*/

export function mapM<A extends object, B, C>(f: (value: B) => Validation<A, C>, bs: B[]): Validation<A, C[]> {
    return sequence(bs.map(f));
}

export function forM<A extends object, B, C>(bs: B[], f: (value: B) => Validation<A, C>): Validation<A, C[]> {
    return mapM(f, bs);
}

export function sequence<A extends object, B>(vbs: Array<Validation<A, B>>): Validation<A, B[]> {
    return liftF((...bs: B[]) => bs, ...vbs);
}

export function mapAndUnzipWith<A extends object, B, C, D>(
    f: (a: B) => Validation<A, [C, D]>,
    bs: B[]): Validation<A, [C[], D[]]> {
    return mapM(f, bs).map(unzip);
}

export function zipWithM<A extends object, B, C, D>(
    f: (b: B, c: C) => Validation<A, D>,
    bs: B[],
    cs: C[]): Validation<A, D[]> {
    return sequence(zipWith(f, bs, cs));
}
