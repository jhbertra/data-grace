export {
    IEither,
    IEitherLeft,
    IEitherRight,
    Either,
    MapEither,
    Left,
    Right,
    forM,
    join,
    lefts,
    liftF,
    liftO,
    mapAndUnzipWith,
    mapM,
    reduceM,
    rights,
    sequence,
    unless,
    when,
    zipWithM,
};

import { unzip, zipWith } from "./array";
import { Just, Maybe, Nothing } from "./maybe";
import { constant, id, objectFromEntries, objectToEntries } from "./prelude";

/*------------------------------
  DATA TYPES
  ------------------------------*/

/**
 * The public methods exposed by the @see Either type.
 */
interface IEither<A, B> {

    /**
     * Extract the value of this @see Either if it is @see Left, or default to a.
     *
     * @example
     *
     *      Right<boolean, string>("foo").defaultLeftWith(true); // true
     *      Left<boolean, string>(false).defaultLeftWith(true); // false
     */
    defaultLeftWith(a: A): A;

    /**
     * Extract the value of this @see Either if it is @see Right, or default to b.
     *
     * @example
     *
     *      Right<boolean, string>("foo").defaultRightWith("bar"); // "foo"
     *      Left<boolean, string>(false).defaultRightWith("bar"); // "bar"
     */
    defaultRightWith(b: B): B;

    /**
     * If this @see Either is a @see Right use its value to compute the next @see Either.
     * Used to compose 2-track pipelines with a short-circuit option.
     *
     * @example
     *
     *      const result = Right("Bob")
     *          .flatMap(name => name === "Jim" ? Right({ agentId: 12 }) : Left("Not Authorized"))
     *          .flatMap(({agentId}) => agentId > 15 ? Right("Access granted") : Left("Access denied"));
     *
     *     result.toString() // "Left (Not Authorized)"
     */
    flatMap<C>(f: (b: B) => Either<A, C>): Either<A, C>;

    /**
     * A type guard which determines if this @see Either is a @see Left
     *
     * @example
     *
     *      const result = Left("error");
     *      if (result.isLeft()) {
     *          result.value; // "error";
     *      }
     */
    isLeft(): this is IEitherLeft<A>;

    /**
     * A type guard which determines if this @see Either is a @see Right
     *
     * @example
     *
     *      const result = Right("Bob");
     *      if (result.isRight()) {
     *          result.value; // "Bob";
     *      }
     */
    isRight(): this is IEitherRight<A>;

    /**
     * Modify the data in the @see Right case.
     *
     * @example
     *
     *     Right("bob").map(name => name.toUpperCase()).toString(); // "Right (BOB)"
     *     Left("error").map(name => name.toUpperCase()).toString(); // "Left (error)"
     */
    map<C>(f: (b: B) => C): Either<A, C>;

    /**
     * Modify the data in the @see Left case.
     *
     * @example
     *
     *     Right("bob").mapLeft(name => name.toUpperCase()).toString(); // "Right (bob)"
     *     Left("error").mapLeft(name => name.toUpperCase()).toString(); // "Left (ERROR)"
     */
    mapLeft<C>(f: (a: A) => C): Either<C, B>;

    /**
     * Run a callback based on the case of the @see Either
     *
     * @example
     *
     *      Right<boolean, string>("bob").matchCase({
     *          left: x => x ? "Yes" : "No",
     *          right: x => x.toUpperCase()); // "BOB"
     *
     *      Left<boolean, string>(false).matchCase({
     *          left: x => x ? "Yes" : "No",
     *          right: x => x.toUpperCase()); // "No"
     */
    matchCase<C>(cases: IEitherCaseScrutinizer<A, B, C>): C;

    /**
     * Pick this @see Either if it is @see Right otherwise pick the other.
     *
     * @example
     *
     *     Right("bob").or(() => Right("sue")).toString(); // "Right (bob)"
     *     Left(false).or(() => Right("sue")).toString(); // "Right (sue)"
     *     Left(false).or(() => Left(true)).toString(); // "Left (true)"
     */
    or(other: () => Either<A, B>): Either<A, B>;

    /**
     * If this @see Either is @see Right replace it with a different @see Either.
     *
     * @example
     *
     *     Right("bob").replace(Right("sue")).toString(); // "Right (sue)"
     *     Right("bob").replace(Left(true)).toString(); // "Left (true)"
     *     Left(false).replace(Right("sue")).toString(); // "Left (false)"
     *     Left(false).replace(Left(true)).toString(); // "Left (false)"
     */
    replace<C>(m: Either<A, C>): Either<A, C>;

    /**
     * If this @see Either is @see Right replace it with a pure value.
     *
     * @example
     *
     *     Right("bob").replace(42).toString(); // "Right (42)"
     *     Left(false).replace(42).toString(); // "Left (false)"
     */
    replacePure<C>(c: C): Either<A, C>;

    /**
     * Convert this @see Either to an array with either one or
     * zero elements.
     *
     * @example
     *
     *     Right("bob").toArray(); // ["bob"]
     *     Left(false).toArray(); // []
     */
    toArray(): B[];

    /**
     * Convert this @see Either to a @see Maybe.
     */
    toMaybe(): Maybe<B>;

    /**
     * Pretty-print this @see Either
     */
    toString(): string;

    /**
     * Discard the value in the @see Either.
     *
     * @example
     *
     *     Right("bob").voidOut().toString(); // "Right ([])"
     *     Left(false).voidOut().toString(); // "Left (false)"
     */
    voidOut(): Either<A, []>;
}

/**
 * Defines the set of functions required to scrutinize the cases of an @see Either.
 */
interface IEitherCaseScrutinizer<A, B, C> {
    /**
     * Callback which is called in the case of a @see Left.
     */
    left(a: A): C;

    /**
     * Callback which is called in the case of a @see Right.
     */
    right(b: B): C;
}

/**
 * The type of an object constructed using the @see Left case.
 */
interface IEitherLeft<A> { readonly tag: "Left"; readonly value: A; }

/**
 * The type of an object constructed using the @see Right case.
 */
interface IEitherRight<B> { readonly tag: "Right"; readonly value: B; }

/**
 * A data type that represents a binary choice - it can be inhabited
 * by either a value of type A, or of type B. A very common use of
 * this data type is to represent the result of a calculation that
 * may fail with some error.  By convention, a correct result will be
 * constructed with the @see Right case constructor, as in the "right"
 * answer, and error results are constructed with the @see Left case
 * constructor.
 */
type Either<A, B> = (IEitherLeft<A> | IEitherRight<B>) & IEither<A, B>;

/**
 * A type transformer that homomorphically maps the @see Either type
 * onto the types of A.
 *
 * @example
 *
 *      // Map the fields of an object
 *      type Foo = { bar: number, baz: string };
 *
 *      // Write a type test that proposes type equality
 *      type PropEquality =
 *          MapEither<string, Foo> extends { bar: Either<string, number>, baz: Either<string, string> }
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
 *          MapEither<string, Foo> extends Either<string, string>[]
 *              ? any
 *              : never;
 *
 *      // Witness the proof of the proposition (compiles)
 *      const proof : PropEquality = "witness"
 */
type MapEither<A, B> = { [K in keyof B]: Either<A, B[K]> };

/*------------------------------
  CONSTRUCTORS
  ------------------------------*/

/**
 * Constructs a new @see Either resolved to the @see Left case using
 * the given value.
 */
function Left<A, B>(value: A): Either<A, B> {
    return Object.freeze({
        defaultLeftWith: constant(value),
        defaultRightWith: id,
        flatMap: (_) => Left(value),
        isLeft: () => true,
        isRight: () => false,
        map: (_) => Left(value),
        mapLeft: (f) => Left(f(value)),
        matchCase: ({ left }) => left(value),
        or: (x) => x(),
        replace: (_) => Left(value),
        replacePure: (_) => Left(value),
        tag: "Left",
        toArray: () => [],
        toMaybe: () => Nothing<B>(),
        toString: () => `Left (${value})`,
        value,
        voidOut: () => Left<A, []>(value),
    }) as Either<A, B>;
}

/**
 * Constructs a new @see Either resolved to the @see Right case using
 * the given value.
 */
function Right<A, B>(value: B): Either<A, B> {
    return Object.freeze({
        defaultLeftWith: id,
        defaultRightWith: constant(value),
        flatMap: (f) => f(value),
        isLeft: () => false,
        isRight: () => true,
        map: (f) => Right(f(value)),
        mapLeft: (_) => Right(value),
        matchCase: ({ right }) => right(value),
        or: (_) => Right(value),
        replace: id,
        replacePure: Right,
        tag: "Right",
        toArray: () => [value],
        toMaybe: () => Just(value),
        toString: () => `Right (${value})`,
        value,
        voidOut: () => Right<A, []>([]),
    }) as Either<A, B>;
}

/*------------------------------
  EITHER FUNCTIONS
  ------------------------------*/

/**
 * Filter out all the @see Right cases.
 *
 * @example
 *
 *     lefts(Right("bob"), Left("error"), Right("sue")); // ["error"]
 */
function lefts<A, B>(es: Array<Either<A, B>>): A[] {
    return es.reduce(
        (state, m) => [...state, ...m.matchCase({ left: (x) => [x], right: () => [] })],
        [] as A[]);
}

/**
 * Filter out all the @see Left cases.
 *
 * @example
 *
 *     lefts(Right("bob"), Left("error"), Right("sue")); // ["bob", "sue"]
 */
function rights<A, B>(es: Array<Either<A, B>>): B[] {
    return es.reduce(
        (state, m) => [...state, ...m.matchCase({ left: () => [], right: (x) => [x] })],
        [] as B[]);
}

/*------------------------------
  GENERAL LIFTING FUNCTIONS
  ------------------------------*/

/**
 * Composes an Either by applying a function to each argument
 * if they are all @see Right
 *
 * In order to satisfy the consistency of results between
 *
 * liftF(f, e1, e2) == e1.flatMap(v1 => e2.map(v2 => f(v1, v2)));
 *
 * The first failure will be returned. For a similar structure that
 * aggregates failures, @see Validation which does not provide and implementaion of @see flatMap
 *
 * @example
 *
 *      function answerTrueFalse(question: string, answer: boolean): string {
 *          return `${question} ${answer}`;
 *      }
 *
 *      liftF(answerTrueFalse, Left("error1"), Left("error2")).toString(); // "Left (error2)"
 *      liftF(answerTrueFalse, Right("The meaning of life is 42."), Left("error2")).toString(); // "Left (error2)"
 *      // "Right (The meaning of life is 42. true)"
 *      liftF(answerTrueFalse, Right("The meaning of life is 42."), Right(true)).toString();
 */
function liftF<A, P extends any[], R>(f: (...args: P) => R, ...args: MapEither<A, P>): Either<A, R> {
    const errors = lefts(args);

    return errors.length === 0
        ? Right(f.apply(undefined, rights(args) as P))
        : Left(errors[0]);
}

/**
 * Composes an @see Either by constructing an object out of
 * multiple @see Eithers. If all the components are @see Right,
 * The object will be constructed, otherwise the first error will
 * be returned.
 *
 * @example
 *
 *      type Foo = { bar: string, baz: Maybe<boolean> };
 *
 *      // Left (invalid bar)
 *      liftO<string, Foo>({
 *          bar: Left("invalid bar"),
 *          baz: Left("invalid baz")
 *      });
 *
 *      // Left (invalid baz)
 *      liftO<string, Foo>({
 *          bar: Right("BAR"),
 *          baz: Left("invalid baz")
 *      });
 *
 *      // Right ({ bar: "BAR", baz: { tag: "Just", value: "baz" } })
 *      liftO<string, Foo>({
 *          bar: Right("BAR"),
 *          baz: Right(Just("baz"))
 *      });
 */
function liftO<A, T extends object>(spec: MapEither<A, T>): Either<A, T> {
    const maybeKvps = sequence(objectToEntries(spec).map(
        ([key, value]) => value.map((x) => [key, x] as [keyof T, T[typeof key]])));

    return maybeKvps.map(objectFromEntries);
}

/*------------------------------
  KLIESLI COMPOSITION FUNCTIONS
  ------------------------------*/

/**
 * Maps a function over an array of inputs and produces an @see Either for each,
 * then aggregates the results inside of an @see Either.
 */
function mapM<A, B, C>(f: (value: B) => Either<A, C>, bs: B[]): Either<A, C[]> {
    return sequence(bs.map(f));
}

/**
 * @see mapM with its arguments reversed.
 */
function forM<A, B, C>(bs: B[], f: (value: B) => Either<A, C>): Either<A, C[]> {
    return mapM(f, bs);
}

/**
 * Aggregate a sequence of @see Eithers and combine their results.
 */
function sequence<A, B>(ebs: Array<Either<A, B>>): Either<A, B[]> {
    return liftF((...bs: B[]) => bs, ...ebs);
}

/**
 * Maps a decomposition of parts over an array of inputs.
 * @param f A decomposition function
 * @param as An array of inputs
 */
function mapAndUnzipWith<A, B, C, D>(f: (a: B) => Either<A, [C, D]>, bs: B[]): Either<A, [C[], D[]]> {
    return mapM(f, bs).map(unzip);
}

/**
 * Reads two input arrays in-order and produces an @see Either for each pair,
 * then aggregates the results.
 */
function zipWithM<A, B, C, D>(f: (b: B, c: C) => Either<A, D>, bs: B[], cs: C[]): Either<A, D[]> {
    return sequence(zipWith(f, bs, cs));
}

/**
 * Reduce an initial state over an array of inputs, with a 2-track decision
 * being made at each step.
 *
 * @example
 *
 *      function validateSequential([first, ...ns]: number[]): Either<string, number[]> {
 *          return reduceM(
 *              ([...x, prev], next) => next - prev === 1
 *                  ? Right([...x, prev, next])
 *                  : Left(`${next} does not follow ${prev}`),
 *              [first],
 *              ns);
 *      }
 */
function reduceM<A, B, C>(f: (state: C, b: B) => Either<A, C>, seed: C, bs: B[]): Either<A, C> {
    return bs.reduce(
        (state, a) => state.flatMap((b) => f(b, a)),
        Right<A, C>(seed));
}

/*------------------------------
  GENERAL MONAD FUNCTIONS
  ------------------------------*/

/**
 * Flatten a nested structure.
 */
function join<A, B>(m: Either<A, Either<A, B>>): Either<A, B> {
    return m.flatMap(id);
}

/**
 * If a condition is true, run the given choice, otherwise skip it.
 */
function when<A>(b: boolean, e: Either<A, []>): Either<A, []> {
    return b ? e : Right([]);
}

/**
 * Unless a condition is true, run the given choice, otherwise skip it.
 */
function unless<A>(b: boolean, e: Either<A, []>): Either<A, []> {
    return when(!b, e);
}
