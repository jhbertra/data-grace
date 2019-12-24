import { MapArray, unzip } from "./array";
import { objectFromEntries, objectToEntries, id } from "./prelude";

/*------------------------------
  DATA TYPES
  ------------------------------*/

/**
 * A type transformer that homomorphically maps the
 * [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)
 * type onto the types of A.
 *
 * ```ts
 * type Example = MapPromise<{a: string, b: number}> // Example = {a: Promise<string>, b: Promise<number>}
 * ```
 */
export type MapPromise<A> = { [K in keyof A]: Promise<A[K]> };

export const Promises = {
  /*------------------------------
  GENERAL LIFTING FUNCTIONS
  ------------------------------*/

  /**
   * Creates a promise which calls a if and when all its arguments
   * are resolved.
   *
   * ```ts
   * answerTrueFalse(question: string, answer: boolean): string {
   *     return `${question} ${answer}`;
   * }
   *
   * const ans = await lift(answerTrueFalse, Promise.resolve("The meaning of life is 42."), Promise.resolve(true));
   * ans === "The meaning of life is 42. true"; // true
   * ```
   *
   * @param f a to lift to operate on promises
   * @param args lifted arguments to `f`
   * @returns the result of evaluating `f` in a promise on the values produced by `args`
   */
  async lift<P extends any[], R>(f: (...args: P) => R, ...args: MapPromise<P>): Promise<R> {
    return f.apply(undefined, (await Promise.all(args)) as P);
  },

  /**
   * Creates a promise which constructs an object if and when all its components
   * are resolved.
   *
   * ```ts
   * type Foo = { bar: string, baz: Maybe<boolean> };
   *
   * // foo == Promise.resolve({ bar: "BAR", baz: { __case: "Just", value: "baz" } });
   * const foo = await record<Foo>({
   *     bar: Promise.resolve("BAR"),
   *     baz: Promise.resolve(Just("baz"))
   * });
   * ```
   *
   * @param spec an object composed of promises to build the result out of in a promise.
   * @returns a promise which will produce a `T` with the outputs of the promises in `spec`.
   */
  async record<T extends object>(spec: MapPromise<T>): Promise<T> {
    const kvpsPromise = Promise.all(
      objectToEntries(spec).map(([key, value]) =>
        value.then(x => [key, x] as [keyof T, T[typeof key]]),
      ),
    );

    return objectFromEntries(await kvpsPromise);
  },

  /*------------------------------
  KLIESLI COMPOSITION FUNCTIONS
  ------------------------------*/

  /**
   * Maps a over an array of inputs and produces a
   * [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)
   * for each, then aggregates the results inside of a
   * [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise).
   *
   * ```ts
   * mapM(url => fetchResourceFromUrl(url), urlsToFetch); // Promise<Resource[]>
   * ```
   *
   * @param f produces a promise for each element in `as`
   * @param as an array of inputs.
   * @returns a promise witch produces the values produced by `f` in order.
   */
  mapM<A, B>(f: (value: A) => Promise<B>, as: A[]): Promise<B[]> {
    return Promise.all(as.map(f));
  },

  /**
   * [[mapM]] with its arguments reversed. Generally provides better
   * ergonomics when `f` is a lambda (squint and it looks a bit like a `for` loop).
   *
   * ```ts
   * forM(urlsToFetch, url => fetchResourceFromUrl(url)); // Promise<Resource[]>
   * ```
   *
   * @param f produces a promise for each element in `as`
   * @param as an array of inputs.
   * @returns a promise witch produces the values produced by `f` in order.
   */
  forM<A, B>(as: A[], f: (value: A) => Promise<B>): Promise<B[]> {
    return Promises.mapM(f, as);
  },

  /**
   * Maps a decomposition of parts over an array of inputs.
   *
   * ```ts
   * declare fetchActionHistory(id: number): Promise<Action[]>;
   * declare partitionByType(history: Action[]): [CreateAction[], EditAction[], ReadAction[], DeleteAction[]];
   * mapAndUnzipWith(
   *     id => fetchActionHistory(id).then(partitionByType),
   *     idsToFetch); // E.g. Promise<[CreateAction[], EditAction[], ReadAction[], DeleteAction[]]>
   * ```
   *
   * @param f A decomposition function
   * @param as An array of inputs
   * @param n optional param to control the number of buckets in the case of empty input.
   */
  async mapAndUnzipWith<N extends number, A, P extends any[] & { length: N }>(
    f: (a: A) => Promise<P>,
    as: A[],
    n: N = 0 as any,
  ): Promise<MapArray<P>> {
    return unzip(await Promises.mapM(f, as), n);
  },

  /**
   * Reads two input arrays in-order and produces a
   * [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)
   * for each pair, then aggregates the results.
   *
   * ```ts
   * zipWithM((id, token) => fetchResource(id, token), ids, tokens); // Promise<Resource[]>
   * ```
   *
   * @param f A to combine each element of the input arrays in-order into a promise
   * @param as An input array.
   * @param params Additional arrays to zip.
   */
  zipWithM<A, P extends any[], C>(
    f: (a: A, ...params: P) => Promise<C>,
    as: A[],
    ...params: MapArray<P>
  ): Promise<C[]> {
    return Promise.all(as.zipWith(f, ...(params as any)));
  },

  /*------------------------------
  GENERAL MONAD FUNCTIONS
  ------------------------------*/

  /**
   * Flatten a nested structure.
   *
   * @param m a nested promise to flatten.
   */
  join<A>(m: Promise<Promise<A>>): Promise<A> {
    return m.then(id);
  },
};
