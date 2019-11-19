export {
  IEither,
  EitherCaseScrutinizer,
  Either,
  MapEither,
  Left,
  Right,
  arrayToEither,
  forM,
  join,
  lefts,
  lift,
  build,
  mapAndUnzipWith,
  mapM,
  maybeToEither,
  reduceM,
  rights,
  sequence,
  unless,
  when,
  zipWithM,
};

import { MapArray, unzip } from "./array";
import { Just, Maybe, Nothing } from "./maybe";
import {
  constant,
  Data,
  data,
  id,
  objectFromEntries,
  objectToEntries,
} from "./prelude";

/*------------------------------
  DATA TYPES
  ------------------------------*/

/**
 * The public methods exposed by the [[Either]] type.
 */
interface IEither<A, B> {
  /**
   * Extract the value of this [[Either]] if it is [[Left]], or default to a.
   *
   * ```ts
   * Right<boolean, string>("foo").defaultLeftWith(true); // true
   * Left<boolean, string>(false).defaultLeftWith(true); // false
   * ```
   *
   * @param a The value to return in case this is [[Right]]
   * @returns The [[Left]] value within this [[Either]] or `a`.
   */
  defaultLeftWith(a: A): A;

  /**
   * Extract the value of this [[Either]] if it is [[Right]], or default to b.
   *
   * ```ts
   * Right<boolean, string>("foo").defaultRightWith("bar"); // "foo"
   * Left<boolean, string>(false).defaultRightWith("bar"); // "bar"
   * ```
   *
   * @param b The value to return in case this is [[Left]]
   * @returns The [[Right]] value within this [[Either]] or `b`.
   */
  defaultRightWith(b: B): B;

  /**
   * If this [[Either]] is a [[Right]] use its value to compute the next [[Either]].
   * Used to compose 2-track pipelines with a short-circuit option.
   *
   * ```ts
   * const result = Right("Bob")
   * chain(name => name === "Jim" ? Right({ agentId: 12 }) : Left("Not Authorized"))
   * chain(({agentId}) => agentId > 15 ? Right("Access granted") : Left("Access denied"));
   *
   * result.toString() // "Left (Not Authorized)"
   * ```
   *
   * @param f a function to produce the next [[Either]] when this [[Either]] is [[Right]].
   * @returns The result of running `f` if this [[Either]] is [[Right]].
   */
  chain<C>(f: (b: B) => Either<A, C>): Either<A, C>;

  /**
   * A type guard which determines if this [[Either]] is a [[Left]]
   *
   * ```ts
   * const result = Left("error");
   * if (result.isLeft()) {
   *     result.value; // "error";
   * }
   * ```
   *
   * @returns true if this is a [[Left]], false otherwise.
   */
  isLeft(): this is Data<"Left", A>;

  /**
   * A type guard which determines if this [[Either]] is a [[Right]]
   *
   * ```ts
   * const result = Right("Bob");
   * if (result.isRight()) {
   *     result.value; // "Bob";
   * }
   * ```
   *
   * @returns true if this is a [[Right]], false otherwise.
   */
  isRight(): this is Data<"Right", B>;

  /**
   * Convert this [[Either]] to a [[Maybe]].
   *
   * ```ts
   * Right("bob").leftToMaybe(); // Nothing
   * Left(false).leftToMaybe(); // Just(false)
   * ```
   *
   * @returns A [[Maybe]] containing the [[Left]] value contained by this [[Either]], else [[Nothing]].
   */
  leftToMaybe(): Maybe<A>;

  /**
   * Modify the data in the [[Right]] case.
   *
   * ```ts
   * Right("bob").map(name => name.toUpperCase()).toString(); // "Right (BOB)"
   * Left("error").map(name => name.toUpperCase()).toString(); // "Left (error)"
   * ```
   *
   * @param f a function that modifies the [[Right]] value within this [[Either]].
   * @returns an [[Either]] with its [[Right]] value transformed.
   */
  map<C>(f: (b: B) => C): Either<A, C>;

  /**
   * Modify the data in the [[Left]] case.
   *
   * ```ts
   * Right("bob").mapLeft(name => name.toUpperCase()).toString(); // "Right (bob)"
   * Left("error").mapLeft(name => name.toUpperCase()).toString(); // "Left (ERROR)"
   * ```
   *
   * @param f a function that modifies the [[Left]] value within this [[Either]].
   * @returns an [[Either]] with its [[Left]] value transformed.
   */
  mapLeft<C>(f: (a: A) => C): Either<C, B>;

  /**
   * Run a callback based on the case of the [[Either]]
   *
   * ```ts
   * Right<boolean, string>("bob").matchCase({
   *     left: x => x ? "Yes" : "No",
   *     right: x => x.toUpperCase()); // "BOB"
   *
   * Left<boolean, string>(false).matchCase({
   *     left: x => x ? "Yes" : "No",
   *     right: x => x.toUpperCase()); // "No"
   * ```
   *
   * @param cases an object containing callbacks that scrutinize the structure of this [[Either]]
   * @returns the result of calling the appropriate callback in `cases`.
   */
  matchCase<C>(cases: EitherCaseScrutinizer<A, B, C>): C;

  /**
   * Pick this [[Either]] if it is [[Right]] otherwise pick the other.
   *
   * ```ts
   * Right("bob").or(Right("sue")).toString(); // "Right (bob)"
   * Left(false).or(Right("sue")).toString(); // "Right (sue)"
   * Left(false).or(Left(true)).toString(); // "Left (true)"
   * ```
   *
   * @param other an [[Either]] to chose if this one is [[Left]].
   * @returns if `this` is [[Right]], `this`, else `other`.
   */
  or(other: Either<A, B>): Either<A, B>;

  /**
   * If this [[Either]] is [[Right]] replace it with a different [[Either]].
   *
   * ```ts
   * Right("bob").replace(Right("sue")).toString(); // "Right (sue)"
   * Right("bob").replace(Left(true)).toString(); // "Left (true)"
   * Left(false).replace(Right("sue")).toString(); // "Left (false)"
   * Left(false).replace(Left(true)).toString(); // "Left (false)"
   * ```
   *
   * @param m The [[Either]] to replace this one with if it has a value.
   * @returns `m` if `this` is [[Right]], else `this`.
   */
  replace<C>(m: Either<A, C>): Either<A, C>;

  /**
   * If this [[Either]] is [[Right]] replace it with a pure value.
   *
   * ```ts
   * Right("bob").replace(42).toString(); // "Right (42)"
   * Left(false).replace(42).toString(); // "Left (false)"
   * ```
   *
   * @param b the value to replace the contents of this [[Either]] with.
   * @returns An [[Either]] containing `b` if `this` is [[Right]], else `this`.
   */
  replacePure<C>(c: C): Either<A, C>;

  /**
   * Swaps the cases of this [[Either]].
   */
  swap(): Either<B, A>;

  /**
   * Convert this [[Either]] to an array with either one or
   * zero elements.
   *
   * ```ts
   * Right("bob").toArray(); // ["bob"]
   * Left(false).toArray(); // []
   * ```
   *
   * @returns A one-element array containing the [[Right]] value contained by this [[Either]], else an empty array.
   */
  toArray(): B[];

  /**
   * Convert this [[Either]] to a [[Maybe]].
   *
   * ```ts
   * Right("bob").toMaybe(); // Just ("bob")
   * Left(false).toMaybe(); // Nothing
   * ```
   *
   * @returns A [[Maybe]] containing the [[Right]] value contained by this [[Either]], else [[Nothing]].
   */
  toMaybe(): Maybe<B>;

  /**
   * Pretty-print this [[Either]]
   *
   * @returns a string formatted `"Left (...)"` or `"Right (...)"`.
   */
  toString(): string;

  /**
   * Discard the value in the [[Either]].
   *
   * ```ts
   * Right("bob").voidOut().toString(); // "Right ([])"
   * Left(false).voidOut().toString(); // "Left (false)"
   * ```
   *
   * @returns An [[Either]] with an empty array in it, or `this` if `this` is [[Left]].
   */
  voidOut(): Either<A, void>;
}

/**
 * Defines the set of functions required to scrutinize the cases of an [[Either]].
 */
interface EitherCaseScrutinizer<A, B, C> {
  /**
   * Callback which is called in the case of a [[Left]].
   */
  left(a: A): C;

  /**
   * Callback which is called in the case of a [[Right]].
   */
  right(b: B): C;
}

/**
 * A data type that represents a binary choice - it can be inhabited
 * by either a value of type A, or of type B. A very common use of
 * this data type is to represent the result of a calculation that
 * may fail with some error.  By convention, a correct result will be
 * constructed with the [[Right]] case constructor, as in the "right"
 * answer, and error results are constructed with the [[Left]] case
 * constructor.
 */
type Either<A, B> = IEither<A, B> & (Data<"Left", A> | Data<"Right", B>);

/**
 * A type transformer that homomorphically maps the [[Either]] type
 * onto the types of A.
 *
 * ```ts
 * // Example = {a: Either<string, string>, b: Either<string, number>}
 * type Example = MapEither<string, {a: string, b: number}>
 * ```
 */
type MapEither<A, B> = { [K in keyof B]: Either<A, B[K]> };

/*------------------------------
  CONSTRUCTORS
  ------------------------------*/

/**
 * Constructs a new [[Either]] resolved to the [[Left]] case using
 * the given value.
 */
function Left<A, B>(value: A): Either<A, B> {
  return Object.freeze({
    ...data("Left", value),
    defaultLeftWith: constant(value),
    defaultRightWith: id,
    chain() {
      return this;
    },
    isLeft() {
      return true;
    },
    isRight() {
      return false;
    },
    leftToMaybe() {
      return Just(value);
    },
    map() {
      return this;
    },
    mapLeft(f) {
      return Left(f(value));
    },
    matchCase({ left }) {
      return left(value);
    },
    or(x) {
      return x;
    },
    replace() {
      return this;
    },
    replacePure() {
      return this;
    },
    swap() {
      return Right(value);
    },
    toArray() {
      return [];
    },
    toMaybe() {
      return Nothing<B>();
    },
    toString() {
      return `Left (${value})`;
    },
    voidOut() {
      return Left<A, void>(value);
    },
  }) as Either<A, B>;
}

/**
 * Constructs a new [[Either]] resolved to the [[Right]] case using
 * the given value.
 */
function Right<A, B>(value: B): Either<A, B> {
  return Object.freeze({
    ...data("Right", value),
    defaultLeftWith: id,
    defaultRightWith: constant(value),
    chain(f) {
      return f(value);
    },
    isLeft() {
      return false;
    },
    isRight() {
      return true;
    },
    leftToMaybe() {
      return Nothing();
    },
    map(f) {
      return Right(f(value));
    },
    mapLeft() {
      return this;
    },
    matchCase({ right }) {
      return right(value);
    },
    or() {
      return this;
    },
    replace: id,
    replacePure: Right,
    swap() {
      return Left(value);
    },
    toArray() {
      return [value];
    },
    toMaybe() {
      return Just(value);
    },
    toString() {
      return `Right (${value})`;
    },
    voidOut() {
      return Right<A, void>(undefined);
    },
  }) as Either<A, B>;
}

/*------------------------------
  EITHER FUNCTIONS
  ------------------------------*/

/**
 * Creates a new [[Either]] that either contains
 * the first element of arr if it exists, or
 * nothing.
 *
 * ```ts
 * arrayToEither([], "error"); // Left (error)
 * arrayToEither([1], "error"); // Right (1)
 * arrayToEither([1, 2, 3], "error"); // Right(1)
 * ```
 *
 * @param arr An array to convert to an [[Either]]
 * @param a A left value to return if `arr` is empty
 * @returns An [[Either]] containing the first element of `arr`, or a [[Left]] with `a` if it is empty.
 */
function arrayToEither<A, B>(arr: B[], a: A): Either<A, B> {
  return arr.length === 0 ? Left(a) : Right(arr[0]);
}

/**
 * Creates a new [[Either]] that either contains
 * the first element of arr if it exists, or
 * nothing.
 *
 * ```ts
 * maybeToEither(Nothing(), "error"); // Left (error)
 * maybeToEither(Just(1), "error"); // Right (1)
 * ```
 *
 * @param maybe A [[Maybe]] to convert to an [[Either]]
 * @param a A left value to return if `maybe` is empty
 * @returns An [[Either]] containing the value in `maybe`, or a [[Left]] with `a` if it is empty.
 */
function maybeToEither<A, B>(maybe: Maybe<B>, a: A): Either<A, B> {
  return maybe.matchCase({ just: (b: B) => Right(b), nothing: () => Left(a) });
}

/**
 * Filter out all the [[Right]] cases.
 *
 * ```ts
 * lefts(Right("bob"), Left("error"), Right("sue")); // ["error"]
 * ```
 *
 * @param es An array of [[Either]] values.
 * @returns an array containing all [[Left]] values found in `es`.
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
 * Filter out all the [[Left]] cases.
 *
 * ```ts
 * rights(Right("bob"), Left("error"), Right("sue")); // ["bob", "sue"]
 * ```
 *
 * @param es An array of [[Either]] values.
 * @returns an array containing all [[Right]] values found in `es`.
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
 * if they are all [[Right]]
 *
 * In order to satisfy the consistency of results between
 *
 * ```ts
 * lift(f, e1, e2) == e1.chain(v1 => e2.map(v2 => f(v1, v2)));
 * ```
 *
 * The first failure will be returned. For a similar structure that
 * aggregates failures, [[Validation]] which does not provide and implementation of [[chain]]
 *
 * ```ts
 * function answerTrueFalse(question: string, answer: boolean): string {
 *     return `${question} ${answer}`;
 * }
 *
 * lift(answerTrueFalse, Left("error1"), Left("error2")).toString(); // "Left (error2)"
 * lift(answerTrueFalse, Right("The meaning of life is 42."), Left("error2")).toString(); // "Left (error2)"
 * // "Right (The meaning of life is 42. true)"
 * lift(answerTrueFalse, Right("The meaning of life is 42."), Right(true)).toString();
 * ```
 *
 * @param f a function to lift to operate on [[Either]] values.
 * @param args lifted arguments to `f`.
 * @returns the result of evaluating `f` in an [[Either]] on the [[Right]] values contained by `args`.
 */
function lift<A, P extends any[], R>(
  f: (...args: P) => R,
  ...args: MapEither<A, P>
): Either<A, R> {
  const values = [];
  for (const arg of args) {
    if (arg.isLeft()) {
      return arg;
    } else {
      values.push(arg.value);
    }
  }
  return Right(f(...(values as P)));
}

/**
 * Composes an [[Either]] by constructing an object out of
 * multiple [[Either]]s. If all the components are [[Right]],
 * The object will be constructed, otherwise the first error will
 * be returned.
 *
 * ```ts
 * type Foo = { bar: string, baz: Maybe<boolean> };
 *
 * // Left (invalid bar)
 * build<string, Foo>({
 *     bar: Left("invalid bar"),
 *     baz: Left("invalid baz")
 * });
 *
 * // Left (invalid baz)
 * build<string, Foo>({
 *     bar: Right("BAR"),
 *     baz: Left("invalid baz")
 * });
 *
 * // Right ({ bar: "BAR", baz: { tag: "Just", value: "baz" } })
 * build<string, Foo>({
 *     bar: Right("BAR"),
 *     baz: Right(Just("baz"))
 * });
 * ```
 *
 * @param spec an object composed of [[Either]]s to build the result out of in an [[Either]].
 * @returns an [[Either]] which will produce a `T` with the [[Right]] values of the [[Either]]s in `spec`.
 */
function build<A, T extends object>(spec: MapEither<A, T>): Either<A, T> {
  const maybeKvps = sequence(
    objectToEntries(spec).map(([key, value]) =>
      value.map(x => [key, x] as [keyof T, T[typeof key]]),
    ),
  );

  return maybeKvps.map(objectFromEntries);
}

/*------------------------------
  KLIESLI COMPOSITION FUNCTIONS
  ------------------------------*/

/**
 * Maps a function over an array of inputs and produces an [[Either]] for each,
 * then aggregates the results inside of an [[Either]].
 *
 * ```ts
 * mapM(person => maybeToEither(person.middleName, "middleNameRequired"), people); // Either<string, string[]>
 * ```
 *
 * @param f produces an [[Either]] for each element in `bs`
 * @param bs an array of inputs.
 * @returns an [[Either]] witch produces the values produced by `f` in order.
 */
function mapM<A, B, C>(f: (value: B) => Either<A, C>, bs: B[]): Either<A, C[]> {
  return sequence(bs.map(f));
}

/**
 * [[mapM]] with its arguments reversed. Generally provides better
 * ergonomics when `f` is a lambda (squint and it looks a bit like a `for` loop).
 *
 * ```ts
 * forM(people, person =>
 *     maybeToEither(person.middleName, "middleNameRequired")); // Either<string, string[]>
 * ```
 *
 * @param f produces an [[Either]] for each element in `bs`
 * @param bs an array of inputs.
 * @returns an [[Either]] witch produces the values produced by `f` in order.
 */
function forM<A, B, C>(bs: B[], f: (value: B) => Either<A, C>): Either<A, C[]> {
  return mapM(f, bs);
}

/**
 * Aggregate a sequence of [[Either]]s and combine their results.
 *
 * ```ts
 * sequence([]); // Right([])
 * sequence([Left("error")]); // Left(error)
 * sequence([Right(1)]); // Right([1])
 * sequence([Right(1), Left("error"), Right(3)]); // Left(error)
 * sequence([Right(1), Right(2), Right(3)]); // Right([1, 2, 3])
 * ```
 *
 * @param mas an array of [[Maybe]]s to sequence
 * @returns a [[Maybe]] of size `mas.length` if all elements have a value, else [[Nothing]].
 */
function sequence<A, B>(ebs: Array<Either<A, B>>): Either<A, B[]> {
  return lift((...bs: B[]) => bs, ...ebs);
}

/**
 * Maps a decomposition of parts over an array of inputs.
 *
 * @param f A decomposition function
 * @param as An array of inputs
 * @param n optional param to control the number of buckets in the case of empty input.
 */
function mapAndUnzipWith<
  A,
  N extends number,
  B,
  P extends any[] & { length: N }
>(f: (b: B) => Either<A, P>, bs: B[], n: N = 0 as any): Either<A, MapArray<P>> {
  return mapM(f, bs).map(x => unzip(x, n));
}

/**
 * Reads two input arrays in-order and produces an [[Either]] for each pair,
 * then aggregates the results.
 *
 * @param f A function to combine each element of the input arrays in-order into an [[Either]].
 * @param bs An input array.
 * @param params Additional arrays to zip.
 */
function zipWithM<A, B, P extends any[], C>(
  f: (b: B, ...params: P) => Either<A, C>,
  bs: B[],
  ...params: MapArray<P>
): Either<A, C[]> {
  return sequence(bs.zipWith(f, ...(params as any)));
}

/**
 * Reduce an initial state over an array of inputs, with a 2-track decision
 * being made at each step.
 *
 * ```ts
 * function validateSequential([first, ...ns]: number[]): Either<string, number[]> {
 * return reduceM(
 *     ([...x, prev], next) => next - prev === 1
 *         ? Right([...x, prev, next])
 *         : Left(`${next} does not follow ${prev}`),
 *     [first],
 *     ns);
 * }
 * ```
 *
 * @param f a state-reducing function which may short-circuit at any step by returning [[Left]].
 * @returns The result of the reduction in an [[Either]].
 */
function reduceM<A, B, C>(
  f: (state: C, b: B) => Either<A, C>,
  seed: C,
  bs: B[],
): Either<A, C> {
  let state = Right<A, C>(seed);
  for (const b of bs) {
    if (state.isLeft()) {
      return state;
    } else {
      state = state.chain(c => f(c, b));
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
 *
 * ```ts
 * when(middleNameRequired,
 *     maybeToEither(person.middleName, "Middle name required").voidOut());
 * ```
 *
 * @param b the condition which must be satisfied to run `e`.
 * @returns If `b` is `true`, `e`, else `Right([])`.
 */
function when<A>(b: boolean, e: Either<A, []>): Either<A, []> {
  return b ? e : (empty as Either<A, []>);
}

/**
 * Unless a condition is true, run the given choice, otherwise skip it.
 *
 * ```ts
 * unless(middleNameOptional,
 *     maybeToEither(person.middleName, "Middle name required").voidOut());
 * ```
 *
 * @param b the condition which must be dissatisfied to run `e`.
 * @returns If `b` is `false`, `e`, else `Right([])`.
 */
function unless<A>(b: boolean, e: Either<A, []>): Either<A, []> {
  return when(!b, e);
}
