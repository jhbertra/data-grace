import {unzip, zipWith} from "./array";
import {objectFromEntries, objectToEntries} from "./prelude";

/*------------------------------
  DATA TYPES
  ------------------------------*/

export type MapPromise<A> = { [K in keyof A]: Promise<A[K]> };

/*------------------------------
  GENERAL LIFTING FUNCTIONS
  ------------------------------*/

export async function liftF<P extends any[], R>(f: (...args: P) => R, ...args: MapPromise<P>): Promise<R> {
    return f.apply(undefined,  (await Promise.all(args)) as P);
}

export async function liftO<T extends object>(spec: MapPromise<T>): Promise<T> {
    const kvpsPromise = Promise.all(objectToEntries(spec).map(
        ([key, value]) => value.then((x) =>  [key, x] as [keyof T, T[typeof key]])));

    return objectFromEntries(await kvpsPromise);
}

/*------------------------------
  KLIESLI COMPOSITION FUNCTIONS
  ------------------------------*/

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
        (state, a) => state.then((b) => f(b, a)),
        Promise.resolve(seed));
}

/*------------------------------
  GENERAL MONAD FUNCTIONS
  ------------------------------*/

export function when(b: boolean, p: Promise<[]>): Promise<[]> {
    return b ? p : Promise.resolve([]);
}

export function unless(b: boolean, p: Promise<[]>): Promise<[]> {
    return when(!b, p);
}

export async function join<A>(m: Promise<Promise<A>>): Promise<A> {
    return await m;
}
