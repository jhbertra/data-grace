import { MapArray, unzip } from "./array";
import { Data, id, objectFromEntries, objectToEntries } from "./prelude";

/*------------------------------
  DATA TYPES
  ------------------------------*/

/**
 * The public methods exposed by the [[Maybe]] type.
 */
export interface IMaybe<A> {
  /**
   * Extract the value of this [[Maybe]] if it has one, or default to a.
   *
   * ```ts
   * Maybe.Just("foo").defaultWith("bar"); // "foo"
   * Nothing().defaultWith("bar"); // "bar"
   * ```
   *
   * @param a The value to return in case this is [[Nothing]]
   * @returns The value within this [[Maybe]] or `a`.
   */
  defaultWith(a: A): A;

  /**
   * Remove unwanted values from this [[Maybe]] with a predicate.
   *
   * ```ts
   * Maybe.Just("foo").filter(x => x === "foo"); // Maybe.Just (foo)
   * Maybe.Just("bar").filter(x => x === "foo"); // Nothing
   * Nothing().filter(x => x === "foo"); // Nothing
   * ```
   *
   * @param p a predicate to test the value against
   * @returns a [[Maybe]] where any value which doesn't satisfy `p` is removed.
   */
  filter(p: (a: A) => boolean): Maybe<A>;

  /**
   * Chain a calculation that may also resolve to a nothing value
   * on the value contained by this [[Maybe]].
   *
   * ```ts
   * Maybe.Just("foo").chain(x => Maybe.Just(`${x}bar`)); // Maybe.Just (foobar)
   * Maybe.Just("foo").chain(x => Nothing()); // Nothing
   * Nothing().chain(x => Maybe.Just(`${x}bar`)); // Nothing
   * Nothing().chain(x => Nothing()); // Nothing
   * ```
   *
   * @param f a to produce the next [[Maybe]] when this [[Maybe]] has a value.
   * @returns The result of running `f` if this [[Maybe]] has a value/.
   */
  chain<B>(f: (a: A) => Maybe<B>): Maybe<B>;

  /**
   * A type guard which determines if this [[Maybe]] is a [[Just]].
   *
   * ```ts
   * const result = Maybe.Just("foo");
   * if (result.isJust()) {
   *     result.value; // "foo";
   * }
   * ```
   *
   * @returns true if this is a [[Just]], false otherwise.
   */
  isJust(): this is Data<"Just", A>;

  /**
   * A type guard which determines if this [[Maybe]] is a [[Nothing]].
   *
   * ```ts
   * const result = Nothing();
   * if (result.isNothing()) {
   *     result.value; // undefined / compiler error.
   * }
   * ```
   *
   * @returns true if this is a [[Nothing]], false otherwise.
   */
  isNothing(): this is Data<"Nothing">;

  /**
   * Transform the value contained by this [[Maybe]].
   *
   * ```ts
   * Maybe.Just("foo").map(x => `${x}bar`); // Maybe.Just (foobar)
   * Nothing().map(x => `${x}bar`); // Nothing
   * ```
   *
   * @param f a that modifies the value within the [[Maybe]].
   * @returns a [[Maybe]] with its contents transformed.
   */
  map<B>(f: (a: A) => B): Maybe<B>;

  /**
   * Run a callback based on the case of the [[Maybe]].
   *
   * ```ts
   * Maybe.Just("foo").matchCase({
   *     just: x => x.toUpperCase(),
   *     nothing: () => "got nothing"); // "FOO"
   *
   * Nothing().matchCase({
   *     just: x => x.toUpperCase(),
   *     nothing: () => "got nothing"); // "got nothing"
   * ```
   *
   * @param cases an object containing callbacks that scrutinize the structure of this [[Maybe]]
   * @returns the result of calling the appropriate callback in `cases`.
   */
  matchCase<B>(cases: MaybeCaseScrutinizer<A, B>): B;

  /**
   * Pick this @Maybe if it has a value otherwise pick the other.
   *
   * ```ts
   * Maybe.Just("bob").or(Just("sue")).toString(); // "Just (bob)"
   * Nothing().or(Just("sue")).toString(); // "Just (sue)"
   * Nothing().or(Nothing()).toString(); // "Nothing"
   * ```
   *
   * @param other a [[Maybe]] to chose if this one is [[Nothing]].
   * @returns the first of `this, other` which has a value, else [[Nothing]].
   */
  or(other: Maybe<A>): Maybe<A>;

  /**
   * Replace the value in this [[Maybe]] with another [[Maybe]].
   *
   * ```ts
   * Maybe.Just("bob").replace(Just("sue")).toString(); // "Just (sue)"
   * Maybe.Just("bob").replace(Nothing()).toString(); // "Nothing"
   * Nothing().replace(Just("sue")).toString(); // "Nothing"
   * Nothing().replace(Nothing()).toString(); // "Nothing"
   * ```
   *
   * @param m The [[Maybe]] to replace this one with if it has a value.
   * @returns `m` if this has a value, else [[Nothing]].
   */
  replace<B>(m: Maybe<B>): Maybe<B>;

  /**
   * Replace the value in this [[Maybe]] with a new value.
   *
   * ```ts
   * Maybe.Just("bob").replace(42).toString(); // "Just (42)"
   * Nothing().replace(42).toString(); // "Nothing"
   * ```
   *
   * @param b the value to replace the contents of this [[Maybe]] with.
   * @returns A [[Maybe]] containing `b` if this has a value, else [[Nothing]].
   */
  replacePure<B>(b: B): Maybe<B>;

  /**
   * Convert this [[Maybe]] to an array with either one or
   * zero elements.
   *
   * ```ts
   * Maybe.Just("bob").toArray(); // [42]
   * Nothing().toArray(); // []
   * ```
   *
   * @returns A one-element array containing the value contained by this [[Maybe]], else an empty array.
   */
  toArray(): A[];

  /**
   * Pretty-print this [[Maybe]]
   *
   * @returns a string formatted `"Just (...)"` or `"Nothing"`.
   */
  toString(): string;

  /**
   * Discard any value contained by this [[Maybe]]
   *
   * @returns A [[Maybe]] with an empty array in it, or [[Nothing]] if this is [[Nothing]].
   */
  voidOut(): Maybe<void>;
}

/**
 * Defines the set of functions required to scrutinize the cases of a [[Maybe]].
 */
interface MaybeCaseScrutinizer<A, B> {
  /**
   * Callback which is called in the case a [[Maybe]] has a value.
   */
  just(a: A): B;

  /**
   * Callback which is called in the case a [[Maybe]] has no value.
   */
  nothing(): B;
}

/**
 * A data type that represents an optional / nullable value.
 * It can either have a value of "just A", or "nothing".
 */
export type Maybe<A> = IMaybe<A> & (Data<"Just", A> | Data<"Nothing">);

/**
 * A type transformer that homomorphically maps the [[Maybe]] type
 * onto the types of A.
 *
 * ```ts
 * type Example = MapMaybe<{a: string, b: number}> // Example = {a: Maybe<string>, b: Maybe<number>}
 * ```
 */
export type MapMaybe<A> = { [K in keyof A]: Maybe<A[K]> };

const staticNothing: Maybe<any> = Object.freeze({
  tag: "Nothing",
  value: undefined,
  defaultWith: id,
  filter() {
    return this;
  },
  chain() {
    return this;
  },
  isJust() {
    return false;
  },
  isNothing() {
    return true;
  },
  map() {
    return this;
  },
  matchCase({ nothing }) {
    return nothing();
  },
  or(m2) {
    return m2;
  },
  replace() {
    return this;
  },
  replacePure() {
    return this;
  },
  toArray() {
    return [];
  },
  toString() {
    return "Nothing";
  },
  voidOut() {
    return staticNothing;
  },
});

export const Maybe = {
  /*------------------------------
    CONSTRUCTORS
    ------------------------------*/

  /**
   * Constructs a new [[Maybe]] that contains a given value.
   */
  Just<A>(value: A): Maybe<A> {
    return Object.freeze({
      tag: "Just",
      value,
      defaultWith() {
        return value;
      },
      filter(p) {
        return p(value) ? this : staticNothing;
      },
      chain(f) {
        return f(value);
      },
      isJust() {
        return true;
      },
      isNothing() {
        return false;
      },
      map(f) {
        return Maybe.Just(f(value));
      },
      matchCase({ just }) {
        return just(value);
      },
      or() {
        return this;
      },
      replace: id,
      replacePure: Maybe.Just,
      toArray() {
        return [value];
      },
      toString() {
        return `Just (${value})`;
      },
      voidOut() {
        return Maybe.Just(undefined as void);
      },
    });
  },

  /**
   * Constructs a new [[Maybe]] that contains no value.
   */
  Nothing<A>(): Maybe<A> {
    return staticNothing as Maybe<A>;
  },

  /*------------------------------
    MAYBE FUNCTIONS
    ------------------------------*/

  /**
   * Creates a new [[Maybe]] that either contains
   * the first element of arr if it exists, or
   * nothing.
   *
   * ```ts
   * arrayToMaybe([]); // Nothing
   * arrayToMaybe([1]); // Maybe.Just (1)
   * arrayToMaybe([1, 2, 3]); // Maybe.Just(1)
   * ```
   *
   * @param arr An array to convert to a [[Maybe]]
   * @returns A [[Maybe]] containing the first element of `arr`, or [[Nothing]] if it is empty.
   */
  arrayToMaybe<A>(arr: A[]): Maybe<A> {
    return arr.length === 0 ? staticNothing : Maybe.Just(arr[0]);
  },

  /**
   * Creates a new [[Maybe]] that either contains
   * the first element of arr if it exists and the tail, or
   * nothing.
   *
   * ```ts
   * arrayToMaybe([]); // Nothing
   * arrayToMaybe([1]); // Maybe.Just ([1, []])
   * arrayToMaybe([1, 2, 3]); // Maybe.Just([1, [2. 3]])
   * ```
   *
   * @param arr An array to convert to a [[Maybe]]
   * @returns A [[Maybe]] containing the first element of `arr` and the tail, or [[Nothing]] if it is empty.
   */
  unCons<A>(arr: A[]): Maybe<[A, A[]]> {
    return arr.length === 0 ? staticNothing : Maybe.Just([arr[0], arr.slice(1)]);
  },

  /**
   * Returns a list of all values found in the input list.
   *
   * ```ts
   * catMaybes([Just("foo"), Nothing(), Maybe.Just("bar")]); // ["foo", "bar"]
   * ```
   *
   * @param ms An array of [[Maybe]] values.
   * @returns an array containing all data found in `ms`.
   */
  catMaybes<A>(ms: Array<Maybe<A>>): A[] {
    const results: A[] = [];
    for (const m of ms) {
      if (m.isJust()) {
        results.push(m.value);
      }
    }
    return results;
  },

  dataToMaybe<
    Case extends Tag,
    Tag extends string,
    TData extends Data<Tag, any>,
    T extends TData extends Data<Case, infer TT> ? TT : never
  >(match: Case, data: TData): Maybe<T> {
    return data.tag === match ? Maybe.Just(data.value) : Maybe.Nothing();
  },

  /**
   * Analog of
   * [Array.prototype.map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map)
   * which allows the mapping to discard values.
   *
   * ```ts
   * mapMaybes(f, arr) === catMaybes(arr.map(f));
   * ```
   *
   * @param f a mapping which can discard values if desired.
   * @returns the contents of `as` transformed by `f` when a value was returned.
   */
  mapMaybe<A, B>(f: (value: A) => Maybe<B>, as: A[]): B[] {
    const results: B[] = [];
    for (const a of as) {
      const m = f(a);
      if (m.isJust()) {
        results.push(m.value);
      }
    }
    return results;
  },

  /**
   * Creates a new [[Maybe]] from an optional value, either returning a [[Just]] or a
   * [[Nothing]] depending if the value is defined or not.
   *
   * ```ts
   * toMaybe(null); // Nothing
   * toMaybe(undefined); // Nothing
   * toMaybe(12); // Maybe.Just(12)
   * ```
   *
   * @param value the value to wrap in a [[Maybe]].
   * @returns `Just(value)` if value is non-null and defined, else `Nothing`.
   */
  toMaybe<A>(value: A | null | undefined): Maybe<A> {
    return value == null ? staticNothing : Maybe.Just(value);
  },

  /*------------------------------
    GENERAL LIFTING FUNCTIONS
    ------------------------------*/

  /**
   * Composes a Maybe by applying a to each argument
   * if they all have values
   *
   * ```ts
   * answerTrueFalse(question: string, answer: boolean): string {
   *     return `${question} ${answer}`;
   * }
   *
   * lift(answerTrueFalse, Nothing(), Nothing()).toString(); // "Nothing"
   * lift(answerTrueFalse, Maybe.Just("The meaning of life is 42."), Nothing()).toString(); // "Nothing"
   * // "Just (The meaning of life is 42. true)"
   * lift(answerTrueFalse, Maybe.Just("The meaning of life is 42."), Maybe.Just(true)).toString();
   * ```
   *
   * @param f a to lift to operate on [[Maybe]] values.
   * @param args lifted arguments to `f`.
   * @returns the result of evaluating `f` in a [[Maybe]] on the values contained by `args`.
   */
  lift<P extends any[], R>(f: (...args: P) => R, ...args: MapMaybe<P>): Maybe<R> {
    const values = [];
    for (const arg of args) {
      if (arg.isNothing()) {
        return arg;
      } else {
        values.push(arg.value);
      }
    }
    return Maybe.Just(f(...(values as P)));
  },

  /**
   * Composes a [[Maybe]] by constructing an object out of
   * multiple [[Maybe]]s. If all the components have a value,
   * the result will also have a value, otherwise nothing will be
   * returned.
   *
   * ```ts
   * type Foo = { bar: string, baz: Maybe<boolean> };
   *
   * // Nothing
   * record<Foo>({
   *     bar: Nothing(),
   *     baz: Nothing()
   * });
   *
   * // Nothing
   * record<Foo>({
   *     bar: Maybe.Just("BAR"),
   *     baz: Nothing()
   * });
   *
   * // Maybe.Just ({ bar: "BAR", baz: { tag: "Just", value: "baz" } })
   * record<Foo>({
   *     bar: Maybe.Just("BAR"),
   *     baz: Maybe.Just(Just("baz"))
   * });
   * ```
   *
   * @param spec an object composed of [[Maybe]]s to build the result out of in a [[Maybe]].
   * @returns a [[Maybe]] which will produce a `T` with the outputs of the [[Maybe]]s in `spec`.
   */
  record<T extends object>(spec: MapMaybe<T>): Maybe<T> {
    const maybeKvps = Maybe.sequence(
      objectToEntries(spec).map(([key, value]) =>
        value.map(x => [key, x] as [keyof T, T[typeof key]]),
      ),
    );

    return maybeKvps.map(objectFromEntries);
  },

  /*------------------------------
    KLIESLI COMPOSITION FUNCTIONS
    ------------------------------*/

  /**
   * Maps a over an array of inputs and produces a [[Maybe]] for each,
   * then aggregates the results inside of a [[Maybe]].
   *
   * ```ts
   * mapM(person => person.middleName, people); // Maybe<string[]>
   * ```
   *
   * @param f produces a [[Maybe]] for each element in `as`
   * @param as an array of inputs.
   * @returns a [[Maybe]] witch produces the values produced by `f` in order.
   */
  mapM<A, B>(f: (value: A) => Maybe<B>, as: A[]): Maybe<B[]> {
    return Maybe.sequence(as.map(f));
  },

  /**
   * [[mapM]] with its arguments reversed. Generally provides better
   * ergonomics when `f` is a lambda (squint and it looks a bit like a `for` loop).
   *
   * ```ts
   * forM(people, person => person.middleName); // Maybe<string[]>
   * ```
   *
   * @param f produces a [[Maybe]] for each element in `as`
   * @param as an array of inputs.
   * @returns a [[Maybe]] witch produces the values produced by `f` in order.
   */
  forM<A, B>(as: A[], f: (value: A) => Maybe<B>): Maybe<B[]> {
    return Maybe.mapM(f, as);
  },

  /**
   * Aggregate a sequence of [[Maybe]]s and combine their results.
   *
   * ```ts
   * sequence([]); // Maybe.Just([])
   * sequence([Nothing()]); // Nothing
   * sequence([Just(1)]); // Maybe.Just([1])
   * sequence([Just(1), Nothing(), Maybe.Just(3)]); // Nothing
   * sequence([Just(1), Maybe.Just(2), Maybe.Just(3)]); // Maybe.Just([1, 2, 3])
   * ```
   *
   * @param mas an array of [[Maybe]]s to sequence
   * @returns a [[Maybe]] of size `mas.length` if all elements have a value, else [[Nothing]].
   */
  sequence<A>(mas: Array<Maybe<A>>): Maybe<A[]> {
    return Maybe.lift((...as: A[]) => as, ...mas);
  },

  /**
   * Maps a decomposition of parts over an array of inputs.
   *
   * @param f A decomposition function.
   * @param as An array of inputs.
   * @param n optional param to control the number of buckets in the case of empty input.
   */
  mapAndUnzipWith<N extends number, A, P extends any[] & { length: N }>(
    f: (a: A) => Maybe<P>,
    as: A[],
    n: N = 0 as any,
  ): Maybe<MapArray<P>> {
    return Maybe.mapM(f, as).map(x => unzip(x, n));
  },

  /**
   * Reads two input arrays in-order and produces a [[Maybe]] for each pair,
   * then aggregates the results.
   *
   * @param f A to combine each element of the input arrays in-order into a [[Maybe]].
   * @param as An input array.
   * @param params Additional arrays to zip.
   */
  zipWithM<A, P extends any[], C>(
    f: (a: A, ...params: P) => Maybe<C>,
    as: A[],
    ...params: MapArray<P>
  ): Maybe<C[]> {
    return Maybe.sequence(as.zipWith(f, ...(params as any)));
  },

  /**
   * Reduce an initial state over an array of inputs, with an optional result calculated
   * over each step.
   *
   * ```ts
   * nothingIfNotSequential([first, ...ns]: number[]): Maybe<number[]> {
   *     return reduceM(
   *         ([...x, prev], next) => next - prev === 1
   *             ? Maybe.Just([...x, prev, next])
   *             : staticNothing,
   *         [first],
   *         ns);
   * }
   * ```
   *
   * @param f a state-reducing which may short-circuit at any step by returning [[Nothing]].
   * @returns The result of the reduction in a [[Maybe]].
   */
  reduceM<A, B>(f: (state: B, a: A) => Maybe<B>, seed: B, as: A[]): Maybe<B> {
    let state = Maybe.Just<B>(seed);
    for (const a of as) {
      if (state.isNothing()) {
        return state;
      } else {
        state = state.chain(b => f(b, a));
      }
    }
    return state;
  },

  /*------------------------------
    GENERAL MONAD FUNCTIONS
    ------------------------------*/

  /**
   * Create a [[Maybe]] that has a value when a condition is
   * true. Slightly more optimal when the condition
   * and value are both known ahead of time. Often useful for
   * ensuring a chain of computations only happens when some condition
   * is known upfront.
   *
   * ```ts
   * const censoredFileContents = when(hasPermission).replacePure(fileContents);
   *
   * // Produces the same result, but is slightly less efficient due to the need
   * // to create a closure.
   * const censoredFileContents = Maybe.Just(fileContents).filter(() => hasPermission);
   * ```
   *
   * @param b the condition which must be satisfied to produce a value.
   * @returns A [[Maybe]] with an empty array if `b` is `true`, else [[Nothing]].
   */
  when(b: boolean): Maybe<void> {
    return b ? Maybe.Just(undefined) : staticNothing;
  },

  /**
   * Create a [[Maybe]] that has a value when a condition is false.
   *
   * ```ts
   * const censoredFileContents = unless(isClassified).replacePure(fileContents);
   *
   * // Produces the same result, but is slightly less efficient due to the need
   * // to create a closure.
   * const censoredFileContents = Maybe.Just(fileContents).filter(() => !isClassified);
   * ```
   *
   * @param b the condition which must be dissatisfied to produce a value.
   * @returns A [[Maybe]] with an empty array if `b` is `false`, else [[Nothing]].
   */
  unless(b: boolean): Maybe<void> {
    return Maybe.when(!b);
  },

  /**
   * Flatten a nested structure.
   *
   * @param m a nested [[Maybe]] to flatten.
   * @returns a flattened structure.
   */
  join<A>(m: Maybe<Maybe<A>>): Maybe<A> {
    return m.chain(id);
  },
};
