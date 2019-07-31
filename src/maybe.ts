export {
    IMaybe,
    IMaybeCaseScrutinizer,
    IMaybeJust,
    IMaybeNothing,
    Maybe,
    MapMaybe,
    Just,
    Nothing,
    arrayToMaybe,
    catMaybes,
    forM,
    join,
    lift,
    build,
    mapAndUnzipWith,
    mapM,
    mapMaybe,
    reduceM,
    sequence,
    toMaybe,
    unless,
    when,
    zipWithM,
};

import { unzip, zipWith } from "./array";
import { id, objectFromEntries, objectToEntries } from "./prelude";

/*------------------------------
  DATA TYPES
  ------------------------------*/

/**
 * The public methods exposed by the @see Maybe type.
 */
interface IMaybe<A> {

    /**
     * Extract the value of this @see Maybe if it has one, or default to a.
     *
     * @example
     *
     *      Just("foo").defaultWith("bar"); // "foo"
     *      Nothing().defaultWith("bar"); // "bar"
     */
    defaultWith(a: A): A;

    /**
     * Remove unwwanted values from this @see Maybe with a predicate.
     *
     * @example
     *
     *      Just("foo").filter(x => x === "foo"); // Just (foo)
     *      Just("bar").filter(x => x === "foo"); // Nothing
     *      Nothing().filter(x => x === "foo"); // Nothing
     */
    filter(p: (a: A) => boolean): Maybe<A>;

    /**
     * Chain a calculation that may also resolve to a nothing value
     * on the value contained by this @see Maybe
     *
     * @example
     *
     *      Just("foo").flatMap(x => Just(`${x}bar`)); // Just (foobar)
     *      Just("foo").flatMap(x => Nothing()); // Nothing
     *      Nothing().flatMap(x => Just(`${x}bar`)); // Nothing
     *      Nothing().flatMap(x => Nothing()); // Nothing
     */
    flatMap<B>(f: (a: A) => Maybe<B>): Maybe<B>;

    /**
     * A type guard which determines if this @see Maybe is a @see Just
     *
     * @example
     *
     *      const result = Just("foo");
     *      if (result.isJust()) {
     *          result.value; // "foo";
     *      }
     */
    isJust(): this is IMaybeJust<A>;

    /**
     * A type guard which determines if this @see Maybe is a @see Nothing
     *
     * @example
     *
     *      const result = Nothing();
     *      if (result.isNothing()) {
     *          result.value; // undefined / compiler error.
     *      }
     */
    isNothing(): this is IMaybeNothing;

    /**
     * Transform the value contained by this @see Maybe
     *
     * @example
     *
     *      Just("foo").map(x => `${x}bar`); // Just (foobar)
     *      Nothing().map(x => `${x}bar`); // Nothing
     */
    map<B>(f: (a: A) => B): Maybe<B>;

    /**
     * Run a callback based on the case of the @see Either
     *
     * @example
     *
     *      Just("foo").matchCase({
     *          just: x => x.toUpperCase(),
     *          nothing: () => "got nothing"); // "FOO"
     *
     *      Nothing().matchCase({
     *          just: x => x.toUpperCase(),
     *          nothing: () => "got nothing"); // "got nothing"
     */
    matchCase<B>(cases: IMaybeCaseScrutinizer<A, B>): B;

    /**
     * Pick this @Maybe if it has a value otherwise pick the other.
     *
     * @example
     *
     *     Just("bob").or(() => Just("sue")).toString(); // "Just (bob)"
     *     Nothing().or(() => Just("sue")).toString(); // "Just (sue)"
     *     Nothing().or(() => Nothing()).toString(); // "Nothing"
     */
    or(other: () => Maybe<A>): Maybe<A>;

    /**
     * Replace the value in this @see Maybe with another @see Maybe.
     *
     * @example
     *
     *     Just("bob").replace(Just("sue")).toString(); // "Just (sue)"
     *     Just("bob").replace(Nothing()).toString(); // "Nothing"
     *     Nothing().replace(Just("sue")).toString(); // "Nothing"
     *     Nothing().replace(Nothing()).toString(); // "Nothing"
     */
    replace<B>(m: Maybe<B>): Maybe<B>;

    /**
     * Replace the value in this @see Maybe with a new value.
     *
     * @example
     *
     *     Just("bob").replace(42).toString(); // "Just (42)"
     *     Nothing().replace(42).toString(); // "Nothing"
     */
    replacePure<B>(b: B): Maybe<B>;

    /**
     * Convert this @see Maybe to an array with either one or
     * zero elements.
     *
     * @example
     *
     *     Just("bob").toArray(); // [42]
     *     Nothing().toArray(); // []
     */
    toArray(): A[];

    /**
     * Pretty-print this @see Maybe
     */
    toString(): string;

    /**
     * Discard any value contained by this @see Maybe
     */
    voidOut(): Maybe<[]>;

}

/**
 * Defines the set of functions required to scrutinize the cases of a @see Maybe.
 */
interface IMaybeCaseScrutinizer<A, B> {
    /**
     * Callback which is called in the case a @see Maybe has a value.
     */
    just(a: A): B;

    /**
     * Callback which is called in the case a @see Maybe has no value.
     */
    nothing(): B;
}

/**
 * The type of an object constructed using the @see Just case.
 */
interface IMaybeJust<A> {
    /**
     * Data used to identify the type.
     */
    tag: "Just";

    /**
     * The payload of this [[Maybe]]
     */
    value: A;
}

/**
 * The type of an object constructed using the @see Nothing case.
 */
interface IMaybeNothing {
    /**
     * Data used to identify the type.
     */
    tag: "Nothing";
}

/**
 * A data type that represents an optional / nullable value.
 * It can either have a value of "just A", or "nothing".
 */
type Maybe<A> = (IMaybeJust<A> | IMaybeNothing) & IMaybe<A>;

/**
 * A type transformer that homomorphically maps the @see Maybe type
 * onto the types of A.
 */
type MapMaybe<A> = { [K in keyof A]: Maybe<A[K]> };

/*------------------------------
  CONSTRUCTORS
  ------------------------------*/

/**
 * Constructs a new @see Maybe that contains a given value.
 */
function Just<A>(value: A): Maybe<A> {
    return Object.freeze({
        defaultWith: (_) => value,
        filter: (p) => p(value) ? Just(value) : Nothing(),
        flatMap: (f) => f(value),
        isJust: () => true,
        isNothing: () => false,
        map: (f) => Just(f(value)),
        matchCase: ({ just }) => just(value),
        or: (_) => Just(value),
        replace: id,
        replacePure: Just,
        tag: "Just",
        toArray: () => [value],
        toString: () => `Just (${value})`,
        value,
        voidOut: () => Just([] as []),
    });
}

/**
 * Constructs a new @see Maybe that contains no value.
 */
function Nothing<A>(): Maybe<A> {
    return Object.freeze({
        defaultWith: id,
        filter: (_) => Nothing(),
        flatMap: (_) => Nothing(),
        isJust: () => false,
        isNothing: () => true,
        map: (_) => Nothing(),
        matchCase: ({ nothing }) => nothing(),
        or: (m2) => m2(),
        replace: (_) => Nothing(),
        replacePure: (_) => Nothing(),
        tag: "Nothing",
        toArray: () => [],
        toString: () => `Nothing`,
        voidOut: () => Nothing<[]>(),
    }) as Maybe<A>;
}

/*------------------------------
  MAYBE FUNCTIONS
  ------------------------------*/

/**
 * Creates a new @see Maybe from an optional
 * value, either returning a @see Just or a
 * @see Nothing depending if the value is
 * defined or not.
 */
function toMaybe<A>(value?: A): Maybe<A> {
    return value == null ? Nothing() : Just(value);
}

/**
 * Creates a new @see Maybe that either contains
 * the first element of arr if it exists, or
 * nothing.
 */
function arrayToMaybe<A>(arr: A[]): Maybe<A> {
    return arr.length === 0 ? Nothing() : Just(arr[0]);
}

/**
 * Analog of @see Array.prototype.map which allows the mapping
 * function to discard values.
 *
 * @example
 *
 *      mapMaybes(f, arr) === catMaybes(arr.map(f));
 */
function mapMaybe<A, B>(f: (value: A) => Maybe<B>, ms: A[]): B[] {
    return ms
        .map(f)
        .reduce(
            (state, b) => {
                switch (b.tag) {
                    case "Just": return [...state, b.value];
                    case "Nothing": return state;
                }
            },
            [] as B[]);
}

/**
 * Returns a list of all values found in the input list.
 *
 * @example
 *
 *      catMaybes([Just("foo"), Nothing(), Just("bar")]); // ["foo", "bar"]
 */
function catMaybes<A>(ms: Array<Maybe<A>>): A[] {
    return ms.reduce(
        (state, m) => {
            switch (m.tag) {
                case "Just": return [...state, m.value];
                case "Nothing": return state;
            }
        },
        [] as A[]);
}

/*------------------------------
  GENERAL LIFTING FUNCTIONS
  ------------------------------*/

/**
 * Composes a Maybe by applying a function to each argument
 * if they all have values
 *
 * @example
 *
 *      function answerTrueFalse(question: string, answer: boolean): string {
 *          return `${question} ${answer}`;
 *      }
 *
 *      lift(answerTrueFalse, Nothing(), Nothing()).toString(); // "Nothing"
 *      lift(answerTrueFalse, Just("The meaning of life is 42."), Nothing()).toString(); // "Nothing"
 *      // "Just (The meaning of life is 42. true)"
 *      lift(answerTrueFalse, Just("The meaning of life is 42."), Just(true)).toString();
 */
function lift<P extends any[], R>(f: (...args: P) => R, ...args: MapMaybe<P>): Maybe<R> {
    const processedArgs = catMaybes(args);

    return processedArgs.length === args.length
        ? Just(f.apply(undefined, processedArgs as P))
        : Nothing();
}

/**
 * Composes a @see Maybe by constructing an object out of
 * multiple @see Maybes. If all the components have a value,
 * the result will also have a value, otherwise nothing will be
 * returned.
 *
 * @example
 *
 *      type Foo = { bar: string, baz: Maybe<boolean> };
 *
 *      // Nothing
 *      build<Foo>({
 *          bar: Nothing(),
 *          baz: Nothing()
 *      });
 *
 *      // Nothing
 *      build<Foo>({
 *          bar: Just("BAR"),
 *          baz: Nothing()
 *      });
 *
 *      // Just ({ bar: "BAR", baz: { tag: "Just", value: "baz" } })
 *      build<Foo>({
 *          bar: Just("BAR"),
 *          baz: Just(Just("baz"))
 *      });
 */
function build<T extends object>(spec: MapMaybe<T>): Maybe<T> {
    const maybeKvps = sequence(objectToEntries(spec).map(
        ([key, value]) => value.map((x) => [key, x] as [keyof T, T[typeof key]])));

    return maybeKvps.map(objectFromEntries);
}

/*------------------------------
  KLIESLI COMPOSITION FUNCTIONS
  ------------------------------*/

/**
 * Maps a function over an array of inputs and produces a @see Maybe for each,
 * then aggregates the results inside of a @see Maybe.
 */
function mapM<A, B>(f: (value: A) => Maybe<B>, as: A[]): Maybe<B[]> {
    return sequence(as.map(f));
}

/**
 * @see mapM with its arguments reversed.
 */
function forM<A, B>(as: A[], f: (value: A) => Maybe<B>): Maybe<B[]> {
    return mapM(f, as);
}

/**
 * Aggregate a sequence of @see Maybes and combine their results.
 */
function sequence<A>(mas: Array<Maybe<A>>): Maybe<A[]> {
    return lift((...as: A[]) => as, ...mas);
}

/**
 * Maps a decomposition of parts over an array of inputs.
 * @param f A decomposition function
 * @param as An array of inputs
 */
function mapAndUnzipWith<A, B, C>(f: (a: A) => Maybe<[B, C]>, as: A[]): Maybe<[B[], C[]]> {
    return mapM(f, as).map(unzip);
}

/**
 * Reads two input arrays in-order and produces a @see Maybe for each pair,
 * then aggregates the results.
 */
function zipWithM<A, B, C>(f: (a: A, b: B) => Maybe<C>, as: A[], bs: B[]): Maybe<C[]> {
    return sequence(zipWith(f, as, bs));
}

/**
 * Reduce an initial state over an array of inputs, with an optional result calculated
 * over each step.
 *
 * @example
 *
 *      function nothingIfNotSequential([first, ...ns]: number[]): Maybe<number[]> {
 *          return reduceM(
 *              ([...x, prev], next) => next - prev === 1
 *                  ? Just([...x, prev, next])
 *                  : Nothing(),
 *              [first],
 *              ns);
 *      }
 */
function reduceM<A, B>(f: (state: B, a: A) => Maybe<B>, seed: B, as: A[]): Maybe<B> {
    return as.reduce(
        (state, a) => state.flatMap((b) => f(b, a)),
        Just(seed));
}

/*------------------------------
  GENERAL MONAD FUNCTIONS
  ------------------------------*/

/**
 * Create a @see Maybe that has a value when a condition is
 * true. Slightly more optimal when the condition
 * and value are both known ahead of time. Often useful for
 * ensuring a chain of computations only happens when some condition
 * is known upfront.
 *
 * @example
 *
 *      const censoredFileContents = when(hasPermission).replacePure(fileContents);
 *
 *      // Produces the same result, but is slightly less efficient due to the need
 *      // to create a closure.
 *      const censoredFileContents = Just(fileContents).filter(() => hasPermission);
 */
function when(b: boolean): Maybe<[]> {
    return b ? Just([]) : Nothing();
}

/**
 * Create a @see Maybe that has a value when a condition is false.
 */
function unless(b: boolean): Maybe<[]> {
    return when(!b);
}

/**
 * Flatten a nested structure.
 */
function join<A>(m: Maybe<Maybe<A>>): Maybe<A> {
    return m.flatMap(id);
}
