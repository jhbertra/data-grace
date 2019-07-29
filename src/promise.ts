export {
    MapPromise,
    forM,
    join,
    liftF,
    liftO,
    mapAndUnzipWith,
    mapM,
    zipWithM,
};

import {unzip, zipWith} from "./array";
import {objectFromEntries, objectToEntries} from "./prelude";

/*------------------------------
  DATA TYPES
  ------------------------------*/

/**
 * A type transformer that homomorphically maps the @see Maybe type
 * onto the types of A.
 *
 * @example
 *
 *      // Map the fields of an object
 *      type Foo = { bar: number, baz: string };
 *
 *      // Write a type test that proposes type equality
 *      type PropEquality =
 *          MapPromise<Foo> extends { bar: Promise<number>, baz: Promise<string> }
 *              ? any
 *              : never;
 *
 *      // witness the proof of the proposition (compiles)
 *      const proof : PropEquality = "witness"
 *
 * @example
 *
 *      // Map the items of an array
 *      type Foo = string[];
 *
 *      // Write a type test
 *      type PropEquality =
 *          MapPromise<Foo> extends Promise<string>[]
 *              ? any
 *              : never;
 *
 *      // Witness the proof of the proposition (compiles)
 *      const proof : PropEquality = "witness"
 */
type MapPromise<A> = { [K in keyof A]: Promise<A[K]> };

/*------------------------------
  GENERAL LIFTING FUNCTIONS
  ------------------------------*/

/**
 * Creates a promise which calls a function if and when all its arguments
 * are resolved.
 */
async function liftF<P extends any[], R>(f: (...args: P) => R, ...args: MapPromise<P>): Promise<R> {
    return f.apply(undefined,  (await Promise.all(args)) as P);
}

/**
 * Creates a promise which constructs an object if and when all its components
 * are resolved.
 */
async function liftO<T extends object>(spec: MapPromise<T>): Promise<T> {
    const kvpsPromise = Promise.all(objectToEntries(spec).map(
        ([key, value]) => value.then((x) =>  [key, x] as [keyof T, T[typeof key]])));

    return objectFromEntries(await kvpsPromise);
}

/*------------------------------
  KLIESLI COMPOSITION FUNCTIONS
  ------------------------------*/

/**
 * Maps a function over an array of inputs and produces a @see Promise for each,
 * then aggregates the results inside of a @see Promise.
 */
function mapM<A, B>(f: (value: A) => Promise<B>, as: A[]): Promise<B[]> {
    return Promise.all(as.map(f));
}

/**
 * @see mapM with its arguments reversed.
 */
function forM<A, B>(as: A[], f: (value: A) => Promise<B>): Promise<B[]> {
    return mapM(f, as);
}

/**
 * Maps a decomposition of parts over an array of inputs.
 * @param f A decomposition function
 * @param as An array of inputs
 */
async function mapAndUnzipWith<A, B, C>(f: (a: A) => Promise<[B, C]>, as: A[]): Promise<[B[], C[]]> {
    return unzip(await mapM(f, as));
}

/**
 * Reads two input arrays in-order and produces a @see Promise for each pair,
 * then aggregates the results.
 */
function zipWithM<A, B, C>(f: (a: A, b: B) => Promise<C>, as: A[], bs: B[]): Promise<C[]> {
    return Promise.all(zipWith(f, as, bs));
}

/*------------------------------
  GENERAL MONAD FUNCTIONS
  ------------------------------*/

/**
 * Flatten a nested structure.
 */
async function join<A>(m: Promise<Promise<A>>): Promise<A> {
    return await m;
}
