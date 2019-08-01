export {
    IEither,
    IEitherCaseScrutinizer,
    IEitherLeft,
    IEitherRight,
    Either,
    MapEither,
    Left,
    Right,
    forM,
    join,
    lefts,
    lift,
    build,
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
     *          .chain(name => name === "Jim" ? Right({ agentId: 12 }) : Left("Not Authorized"))
     *          .chain(({agentId}) => agentId > 15 ? Right("Access granted") : Left("Access denied"));
     *
     *     result.toString() // "Left (Not Authorized)"
     */
    chain<C>(f: (b: B) => Either<A, C>): Either<A, C>;

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
    isRight(): this is IEitherRight<B>;

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
interface IEitherLeft<A> {
    readonly tag: "Left";
    readonly value: A;
}

/**
 * The type of an object constructed using the @see Right case.
 */
interface IEitherRight<B> {
    readonly tag: "Right";
    readonly value: B;
}

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
        chain() { return this; },
        isLeft() { return true; },
        isRight() { return false; },
        map() { return this; },
        mapLeft(f) { return Left(f(value)); },
        matchCase({ left }) { return left(value); },
        or(x) { return x(); },
        replace() { return this; },
        replacePure() { return this; },
        tag: "Left",
        toArray() { return []; },
        toMaybe() { return Nothing<B>(); },
        toString() { return `Left (${value})`; },
        value,
        voidOut() { return Left<A, []>(value); },
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
        chain(f) { return f(value); },
        isLeft() { return false; },
        isRight() { return true; },
        map(f) { return Right(f(value)); },
        mapLeft() { return this; },
        matchCase({ right }) { return right(value); },
        or() { return this; },
        replace: id,
        replacePure: Right,
        tag: "Right",
        toArray() { return [value]; },
        toMaybe() { return Just(value); },
        toString() { return `Right (${value})`; },
        value,
        voidOut() { return Right<A, []>([]); },
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
    const result: A[] = [];
    for (const e of es) {
        if (e.isLeft()) {
            result.push(e.value);
        }
    }
    return result;
}

/**
 * Filter out all the @see Left cases.
 *
 * @example
 *
 *     rights(Right("bob"), Left("error"), Right("sue")); // ["bob", "sue"]
 */
function rights<A, B>(es: Array<Either<A, B>>): B[] {
    const result: B[] = [];
    for (const e of es) {
        if (e.isRight()) {
            result.push(e.value);
        }
    }
    return result;
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
 * ```ts
 * lift(f, e1, e2) == e1.chain(v1 => e2.map(v2 => f(v1, v2)));
 * ```
 *
 * The first failure will be returned. For a similar structure that
 * aggregates failures, @see Validation which does not provide and implementaion of @see chain
 *
 * @example
 *
 *      function answerTrueFalse(question: string, answer: boolean): string {
 *          return `${question} ${answer}`;
 *      }
 *
 *      lift(answerTrueFalse, Left("error1"), Left("error2")).toString(); // "Left (error2)"
 *      lift(answerTrueFalse, Right("The meaning of life is 42."), Left("error2")).toString(); // "Left (error2)"
 *      // "Right (The meaning of life is 42. true)"
 *      lift(answerTrueFalse, Right("The meaning of life is 42."), Right(true)).toString();
 */
function lift<A, P extends any[], R>(f: (...args: P) => R, ...args: MapEither<A, P>): Either<A, R> {
    const values = [];
    for (const arg of args) {
        if (arg.isLeft()) {
            return arg;
        } else {
            values.push(arg.value);
        }
    }
    return Right(f(...values as P));
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
 *      build<string, Foo>({
 *          bar: Left("invalid bar"),
 *          baz: Left("invalid baz")
 *      });
 *
 *      // Left (invalid baz)
 *      build<string, Foo>({
 *          bar: Right("BAR"),
 *          baz: Left("invalid baz")
 *      });
 *
 *      // Right ({ bar: "BAR", baz: { tag: "Just", value: "baz" } })
 *      build<string, Foo>({
 *          bar: Right("BAR"),
 *          baz: Right(Just("baz"))
 *      });
 */
function build<A, T extends object>(spec: MapEither<A, T>): Either<A, T> {
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
    return lift((...bs: B[]) => bs, ...ebs);
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
    let state = Right<A, C>(seed);
    for (const b of bs) {
        if (state.isLeft()) {
            return state;
        } else {
            state = state.chain((c) => f(c, b));
        }
    }
    return state;
}

/*------------------------------
  GENERAL MONAD FUNCTIONS
  ------------------------------*/

/**
 * Flatten a nested structure.
 */
function join<A, B>(m: Either<A, Either<A, B>>): Either<A, B> {
    return m.chain(id);
}

const empty = Right([]);

/**
 * If a condition is true, run the given choice, otherwise skip it.
 */
function when<A>(b: boolean, e: Either<A, []>): Either<A, []> {
    return b ? e : empty as Either<A, []>;
}

/**
 * Unless a condition is true, run the given choice, otherwise skip it.
 */
function unless<A>(b: boolean, e: Either<A, []>): Either<A, []> {
    return when(!b, e);
}
