import {unzip, zipWith} from "./array";
import {objectToEntries, objectFromEntries} from "./prelude";

/*
 * Data Types
 */
export type MapPromise<A> = { [K in keyof A]: Promise<A[K]> };



/*
 * General lifting functions.
 */

export async function liftF<P extends any[], R>(f: (...args: P) => R, ...args: MapPromise<P>): Promise<R> {
    return f.apply(undefined, <P>(await Promise.all(args)));
}

export async function liftO<T>(spec: MapPromise<T>): Promise<T> {
    const maybeKvps = Promise.all(objectToEntries(spec).map(
        ([key, value]) => value.then(x => <[keyof T, T[typeof key]]>[key, x])));

    return objectFromEntries(await maybeKvps);
}



/*
 * Kliesli composition functions
 */

export function mapM<A, B>(f: (value: A) => Promise<B>, as: A[]): Promise<B[]> {
    return Promise.all(as.map(f));
}

export function forM<A, B>(as: A[], f: (value: A) => Promise<B>): Promise<B[]> {
    return mapM(f, as);
}

export async function mapAndUnzipWith<A, B, C>(f: (a: A) => Promise<[B, C]>, as: A[]): Promise<[B[], C[]]> {
    return unzip(await mapM(f, as));
}

export function zipWithM<A, B, C>(f: (a: A, b: B) => Promise<C>, as: A[], bs: B[]): Promise<C[]> {
    return Promise.all(zipWith(f, as, bs));
}

export function reduceM<A, B>(f: (state: B, a: A) => Promise<B>, seed: B, as: A[]): Promise<B> {
    return as.reduce(
        (state, a) => state.then(b => f(b, a)),
        Promise.resolve(seed));
}



/*
 * General monad functions
 */

export function when(b: boolean, p: Promise<[]>): Promise<[]> {
    return b ? p : Promise.resolve([]);
}

export function unless(b: boolean, p: Promise<[]>): Promise<[]> {
    return when(!b, p);
}

export async function join<A>(m: Promise<Promise<A>>): Promise<A> {
    return await m;
}