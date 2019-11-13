export {
  IValidation,
  ValidationCaseScrutinizer,
  ValidationInvalid,
  ValidationValid,
  Validation,
  MapValidation,
  Valid,
  Invalid,
  arrayToValidation,
  build,
  eitherToValidation,
  failures,
  forM,
  lift,
  mapAndUnzipWith,
  mapM,
  maybeToValidation,
  sequence,
  successful,
  zipWithM
};

import { MapArray, unzip } from "./array";
import { Either, Left, Right } from "./either";
import { Just, Maybe, Nothing } from "./maybe";
import {
  Case,
  constant,
  id,
  objectFromEntries,
  objectToEntries
} from "./prelude";

/*------------------------------
  DATA TYPES
  ------------------------------*/

/**
 * The public methods exposed by the [[Validation]] type.
 */
interface IValidation<A extends object | any[], B> {
  /**
   * Extract the value of this [[Validation]] if it is [[Valid]], or default to b.
   *
   * ```ts
   * Valid("foo").defaultWith("bar"); // "foo"
   * Left(["error"]).defaultWith("bar"); // "bar"
   * ```
   *
   * @param b The value to return in case this is [[Valid]]
   * @returns The value within this [[Validation]] or `b`.
   */
  defaultWith(b: B): B;

  /**
   * A type guard which determines if this [[Validation]] is a [[Invalid]].
   *
   * ```ts
   * const result = Invalid({ failure: "error" });
   * if (result.isInvalid()) {
   *     result.failure; // { failure: "error" };
   * }
   * ```
   *
   * @returns true if this is a [[Invalid]], false otherwise.
   */
  isInvalid(): this is ValidationInvalid<A>;

  /**
   * A type guard which determines if this [[Validation]] is a [[Valid]].
   *
   * ```ts
   * const result = Valid("Bob");
   * if (result.isValid()) {
   *     result.value; // "Bob";
   * }
   * ```
   *
   * @returns true if this is a [[Valid]], false otherwise.
   */
  isValid(): this is ValidationValid<B>;

  /**
   * Modify the data in the [[Valid]] case.
   *
   * ```ts
   * Valid("bob").map(name => name.toUpperCase()).toString(); // "Valid (BOB)"
   * Invalid(["error"]).map(name => name.toUpperCase()).toString(); // "Invalid (["error"])"
   * ```
   *
   * @param f a function that modifies the value within this [[Validation]].
   * @returns a [[Validation]] with its value transformed.
   */
  map<C>(f: (b: B) => C): Validation<A, C>;

  /**
   * Modify the data in the [[Invalid]] case.
   *
   * ```ts
   * Valid("bob").mapError(es => es.map(x => x.toUpperCase())).toString(); // "Valid (bob)"
   * Invalid(["error"]).mapError(es => es.map(x => x.toUpperCase())).toString(); // "Invalid (["ERROR"])"
   * ```
   *
   * @param f a function that modifies the error within this [[Validation]].
   * @returns a [[Validation]] with its error transformed.
   */
  mapError<C extends object | any[]>(f: (a: A) => C): Validation<C, B>;

  /**
   * Run a callback based on the case of the [[Validation]].
   *
   * ```ts
   * Valid("bob").matchCase({
   *     invalid: x => x.length > 0 ? "Yes" : "No",
   *     valid: x => x.toUpperCase()); // "BOB"
   *
   * Invalid([]).matchCase({
   *     invalid: x => x.length > 0 ? "Yes" : "No",
   *     valid: x => x.toUpperCase()); // "No"
   * ```
   *
   * @param cases an object containing callbacks that scrutinize the structure of this [[Validation]]
   * @returns the result of calling the appropriate callback in `cases`.
   */
  matchCase<C>(cases: ValidationCaseScrutinizer<A, B, C>): C;

  /**
   * Pick this [[Validation]] if it is [[Valid]] otherwise pick the other.
   *
   * ```ts
   * Valid("bob").or(Valid("sue")).toString(); // "Valid (bob)"
   * Invalid([false]).or(Valid("sue")).toString(); // "Valid (sue)"
   * Invalid([false]).or(Invalid([true])).toString(); // "Invalid ([true])"
   * ```
   *
   * @param other a [[Validation]] to chose if this one is [[Invalid]].
   * @returns if `this` is [[Valid]], `this`, else `other`.
   */
  or(other: Validation<A, B>): Validation<A, B>;

  /**
   * If this [[Validation]] is [[Valid]] replace it with a different [[Validation]].
   *
   * Aggregates errors.
   *
   * ```ts
   * Valid("bob").replace(Valid("sue")).toString(); // "Valid (sue)"
   * Valid("bob").replace(Invalid([true])).toString(); // "Invalid ([true])"
   * Invalid([false]).replace(Valid("sue")).toString(); // "Invalid ([false])"
   * Invalid([false]).replace(Invalid([true])).toString(); // "Invalid ([false, true])"
   * ```
   *
   * @param m The [[Validation]] to replace this one with if it is [[Valid]].
   * @returns `m` if `this` is [[Valid]], else `this`.
   */
  replace<C>(m: Validation<A, C>): Validation<A, C>;

  /**
   * If this [[Validation]] is [[Valid]] replace it with a pure value.
   *
   * ```ts
   * Valid("bob").replace(42).toString(); // "Valid (42)"
   * Invalid([false]).replace(42).toString(); // "Invalid ([false])"
   * ```
   *
   * @param b the value to replace the contents of this [[Validation]] with.
   * @returns An [[Validation]] containing `b` if `this` is [[Valid]], else `this`.
   */
  replacePure<C>(c: C): Validation<A, C>;

  /**
   * Convert this [[Validation]] to an array with either one or
   * zero elements.
   *
   * ```ts
   * Valid("bob").toArray(); // ["bob"]
   * Invalid(["error"]).toArray(); // []
   * ```
   *
   * @returns A one-element array containing the value contained by this [[Validation]], else an empty array.
   */
  toArray(): B[];

  /**
   * Convert this [[Validation]] to an [[Either]].
   *
   * ```ts
   * Valid("bob").toMaybe(); // Right ("bob")
   * Invalid(["error"]).toMaybe(); // Left ([error])
   * ```
   *
   * @returns A [[Right]] containing the value contained by this [[Validation]], else a [[Left]] containing the error.
   */
  toEither(): Either<A, B>;

  /**
   * Convert this [[Validation]] to a [[Maybe]].
   *
   * ```ts
   * Valid("bob").toMaybe(); // Just ("bob")
   * Invalid(["error"]).toMaybe(); // Nothing
   * ```
   *
   * @returns A [[Maybe]] containing the value contained by this [[Validation]], else [[Nothing]].
   */
  toMaybe(): Maybe<B>;

  /**
   * Pretty-print this [[Validation]].
   *
   * @returns a string formatted `"Valid (...)"` or `"Invalid (...)"`.
   */
  toString(): string;

  /**
   * Discard any value contained by this [[Validation]].
   *
   * ```ts
   * Invalid("bob").voidOut().toString(); // "Invalid ([])"
   * Invalid(["error"]).voidOut().toString(); // "Invalid ([error])"
   * ```
   *
   * @returns An [[Either]] with an empty array in it, or `this` if `this` is [[Left]].
   */
  voidOut(): Validation<A, []>;
}

/**
 * Defines the set of functions required to scrutinize the cases of a [[Validation]].
 */
interface ValidationCaseScrutinizer<A extends object | any[], B, C> {
  /**
   * Callback which is called in the case of [[Invalid]].
   */
  invalid: (a: A) => C;

  /**
   * Callback which is called in the case of [[Valid]].
   */
  valid: (b: B) => C;
}

/**
 * The type of an object constructed using the [[Invalid]] case.
 */
interface ValidationInvalid<A extends object | any[]> {
  readonly failure: A;
}

/**
 * The type of an object constructed using the [[Valid]] case.
 */
interface ValidationValid<B> {
  readonly value: B;
}

/**
 * A data type that represents a calculation which can fail. The primary
 * difference between [[Validation]] and [[Either]] is that [[Validation]]
 * aggregates failures where it can. Its combinators are defined in such a
 * way that failures will accumulate, and as a consequence it is not possible
 * to do sequential validation with chain like one would do with [[Either]].
 */
type Validation<A extends object | any[], B> = IValidation<A, B> &
  (
    | (Case<"Invalid"> & ValidationInvalid<A>)
    | (Case<"Valid"> & ValidationValid<B>)
  );

/**
 * A type transformer that homomorphically maps the [[Validation]] type
 * onto the types of A.
 *
 * ```ts
 * // Example = {a: Validation<string[], string>, b: Validation<string[], number>}
 * type Example = MapValidation<string[], {a: string, b: number}>
 * ```
 */
type MapValidation<A extends object | any[], B> = {
  [K in keyof B]: Validation<A, B[K]>;
};

/*------------------------------
  CONSTRUCTORS
  ------------------------------*/

/**
 * Constructs a new [[Validation]] that represents a valid
 * result.
 */
function Valid<A extends object | any[], B>(value: B): Validation<A, B> {
  return Object.freeze({
    __case: "Valid",
    defaultWith: constant(value),
    isInvalid() {
      return false;
    },
    isValid() {
      return true;
    },
    map(f) {
      return Valid(f(value));
    },
    mapError() {
      return this;
    },
    matchCase({ valid }) {
      return valid(value);
    },
    or() {
      return this;
    },
    replace: id,
    replacePure: Valid,
    toArray() {
      return [value];
    },
    toEither() {
      return Right<A, B>(value);
    },
    toMaybe() {
      return Just<B>(value);
    },
    toString() {
      return `Valid (${value})`;
    },
    value,
    voidOut() {
      return Valid<A, []>([]);
    }
  }) as Validation<A, B>;
}

/**
 * Constructs a new [[Validation]] that represents an invalid
 * result.
 */
function Invalid<A extends object | any[], B>(failure: A): Validation<A, B> {
  return Object.freeze({
    __case: "Invalid",
    defaultWith: id,
    failure,
    isInvalid() {
      return true;
    },
    isValid() {
      return false;
    },
    map() {
      return this;
    },
    mapError(f) {
      return Invalid(f(failure));
    },
    matchCase({ invalid }) {
      return invalid(failure);
    },
    or(x) {
      return x;
    },
    replace(x) {
      return build<
        A,
        { a: B; b: typeof x extends Validation<A, infer C> ? C : never }
      >({
        a: this,
        b: x
      });
    },
    replacePure() {
      return this;
    },
    toArray() {
      return [];
    },
    toEither() {
      return Left<A, B>(failure);
    },
    toMaybe() {
      return Nothing<B>();
    },
    toString() {
      return `Invalid (${failure})`;
    },
    voidOut() {
      return Invalid<A, []>(failure);
    }
  }) as Validation<A, B>;
}

/*------------------------------
  VALIDATION FUNCTIONS
  ------------------------------*/

/**
 * Creates a new [[Validation]] that either contains
 * the first element of arr if it exists, or `Invalid(a)`.
 *
 * ```ts
 * arrayToValidation([], ["error"]); // Invalid ([error])
 * arrayToValidation([1], ["error"]); // Valid (1)
 * arrayToValidation([1, 2, 3], ["error"]); // Valid(1)
 * ```
 *
 * @param arr An array to convert to a [[Validation]].
 * @param a A left value to return if `arr` is empty.
 * @returns An [[Validation]] containing the first element of `arr`, or a [[Invalid]] with `a` if it is empty.
 */
function arrayToValidation<A extends object | any[], B>(
  arr: B[],
  a: A
): Validation<A, B> {
  return arr.length === 0 ? Invalid(a) : Valid(arr[0]);
}

/**
 * Creates a new [[Validation]] that either contains
 * the value in `maybe` or `Invalid(a)`.
 *
 * ```ts
 * maybeToValidation(Nothing(), ["error"]); // Invalid ([error])
 * maybeToValidation(Just(1), ["error"]); // Valid (1)
 * ```
 *
 * @param maybe A [[Maybe]] to convert to a [[Validation]].
 * @param a A left value to return if `maybe` is empty.
 * @returns An [[Validation]] containing the value in `maybe`, or a [[Invalid]] with `a` if it is empty.
 */
function maybeToValidation<A extends object | any[], B>(
  maybe: Maybe<B>,
  a: A
): Validation<A, B> {
  return maybe.matchCase({
    just: (b: B) => Valid(b),
    nothing: () => Invalid(a)
  });
}

/**
 * An isomorphism that maps `Left(a) -> Invalid(a)`
 * and `Right(b) -> Valid(b)`.
 *
 * ```ts
 * eitherToValidation(Left(["error"])); // Invalid ([error])
 * eitherToValidation(Right(1)); // Valid (1)
 * ```
 *
 * @param either A [[Either]] to convert to a [[Validation]]
 * @returns If `either` is [[Left]], [[Invalid]], else [[Valid]].
 */
function eitherToValidation<A extends object | any[], B>(
  either: Either<A, B>
): Validation<A, B> {
  return either.matchCase({
    left: (a: A) => Invalid(a),
    right: (b: B) => Valid(b)
  });
}

/**
 * return a collection of all the failures in the list of validations.
 *
 * ```ts
 * failures(Valid("bob"), Invalid(["error"]), Valid("sue")); // [["error"]]
 * ```
 *
 * @param vs An array of [[Validation]] values.
 * @returns an array containing all [[Invalid]] values found in `vs`.
 */
function failures<A extends object | any[], B>(
  vs: Array<Validation<A, B>>
): A[] {
  const result: A[] = [];
  for (const validation of vs) {
    if (validation.isInvalid()) {
      result.push(validation.failure);
    }
  }
  return result;
}

/**
 * return a collection of all the successes in the list of validations.
 *
 * ```ts
 * successful(Valid("bob"), Invalid(["error"]), Valid("sue")); // ["bob", "sue"]
 * ```
 *
 * @param vs An array of [[Validation]] values.
 * @returns an array containing all [[Valid]] values found in `vs`.
 */
function successful<A extends object | any[], B>(
  vs: Array<Validation<A, B>>
): B[] {
  const result: B[] = [];
  for (const validation of vs) {
    if (validation.isValid()) {
      result.push(validation.value);
    }
  }
  return result;
}

/*------------------------------
  GENERAL LIFTING FUNCTIONS
  ------------------------------*/

/**
 * Composes an Validation by applying a function to each argument
 * if they are all [[Valid]]
 *
 * ```ts
 * function answerTrueFalse(question: string, answer: boolean): string {
 *     return `${question} ${answer}`;
 * }
 *
 * lift(answerTrueFalse, Invalid(["error1"]), Invalid(["error2"])).toString(); // "Invalid (["error1", "error2"])"
 * // "Invalid (["error2"])"
 * lift(answerTrueFalse, Valid("The meaning of life is 42."), Invalid(["error2"])).toString();
 * // "Valid (The meaning of life is 42. true)"
 * lift(answerTrueFalse, Valid("The meaning of life is 42."), Valid(true)).toString();
 * ```
 *
 * @param f a function to lift to operate on [[Validation]] values.
 * @param args lifted arguments to `f`.
 * @returns the result of evaluating `f` in a [[Validation]] on the [[Valid]] values contained by `args`.
 */
function lift<A extends object | any[], P extends any[], R>(
  f: (...args: P) => R,
  ...args: MapValidation<A, P>
): Validation<A, R> {
  const values = [];
  const errors: A[] = [];

  for (const result of args) {
    if (result.isValid()) {
      values.push(result.value);
    } else {
      errors.push(result.failure);
    }
  }

  return values.length === args.length
    ? Valid(f.apply(undefined, values as P))
    : Array.isArray(errors[0])
    ? Invalid(errors.chain(id as any) as A)
    : Invalid(objectFromEntries(errors.chain(objectToEntries)) as A);
}

/**
 * Composes a [[Validation]] by constructing an object out of
 * multiple [[Validations]]. If all the components are [[Valid]],
 * The object will be constructed, otherwise the first error will
 * be returned.
 *
 * ```ts
 * type Foo = { bar: string, baz: Maybe<boolean> };
 *
 * // Left ({ bar: "invalid", baz: "invalid" })
 * build<object, Foo>({
 *     bar: Invalid({ bar: "invalid" }),
 *     baz: Invalid({ baz: "invalid" })
 * });
 *
 * // Left ({ baz: "invalid" })
 * build<object, Foo>({
 *     bar: Valid("BAR"),
 *     baz: Invalid({ baz: "invalid" })
 * });
 *
 * // Valid ({ bar: "BAR", baz: { __case: "Just", value: "baz" } })
 * build<object, Foo>({
 *     bar: Valid("BAR"),
 *     baz: Valid(Just("baz"))
 * });
 * ```
 *
 * @param spec an object composed of [[Validation]]s to build the result out of in a [[Validation]].
 * @returns a [[Validation]] which will produce a `T` with the [[Valid]] values of the [[Validation]]s in `spec`.
 */
function build<A extends object | any[], T extends object>(
  spec: MapValidation<A, T>
): Validation<A, T> {
  const kvpValidation = sequence(
    objectToEntries(spec).map(([key, value]) =>
      value.map(x => [key, x] as [keyof T, T[typeof key]])
    )
  );

  return kvpValidation.map(objectFromEntries);
}

/*------------------------------
  KLIESLI COMPOSITION FUNCTIONS
  ------------------------------*/

/**
 * Maps a function over an array of inputs and produces a [[Validation]] for each,
 * then aggregates the results or failures inside of a [[Validation]].
 *
 * ```ts
 * mapM(
 *     person => maybeToValidation(person.middleName, {[person.id]: "middle name required"}),
 *     people); // Validation<{[id: string]: string}, string[]>
 * ```
 *
 * @param f produces a [[Validation]] for each element in `bs`
 * @param bs an array of inputs.
 * @returns a [[Validation]] witch produces the values produced by `f` in order.
 */
function mapM<A extends object | any[], B, C>(
  f: (value: B) => Validation<A, C>,
  bs: B[]
): Validation<A, C[]> {
  return sequence(bs.map(f));
}

/**
 * [[mapM]] with its arguments reversed. Generally provides better
 * ergonomics when `f` is a lambda (squint and it looks a bit like a `for` loop).
 *
 * ```ts
 * // Validation<{[id: string]: string}, string[]>
 * forM(people, person =>
 *     maybeToValidation(
 *         person.middleName,
 *         {[person.id]: "middle name required"}));
 * ```
 *
 * @param f produces a [[Validation]] for each element in `bs`
 * @param bs an array of inputs.
 * @returns a [[Validation]] witch produces the values produced by `f` in order.
 */
function forM<A extends object | any[], B, C>(
  bs: B[],
  f: (value: B) => Validation<A, C>
): Validation<A, C[]> {
  return mapM(f, bs);
}

/**
 * Aggregate a sequence of [[Validations]] and combine their results or failures.
 *
 * ```ts
 * sequence([]); // Valid([])
 * sequence([Invalid(["error"])]); // Invalid([error])
 * sequence([Valid(1)]); // Valid([1])
 * sequence([Valid(1), Invalid(["error"]), Invalid(["error2"]); // Invalid([error, error2])
 * sequence([Valid(1), Valid(2), Valid(3)]); // Valid([1, 2, 3])
 * ```
 *
 * @param mas an array of [[Validation]]s to sequence
 * @returns a [[Validation]] of size `mas.length` if all elements have a value,
 * else an [[Invalid]] that combines all the errors.
 */
function sequence<A extends object | any[], B>(
  vbs: Array<Validation<A, B>>
): Validation<A, B[]> {
  return lift((...bs: B[]) => bs, ...vbs);
}

/**
 * Maps a decomposition of parts over an array of inputs.
 *
 * @param f A decomposition function
 * @param as An array of inputs
 * @param n optional param to control the number of buckets in the case of empty input.
 */
function mapAndUnzipWith<
  A extends object | any[],
  N extends number,
  B,
  P extends any[] & { length: N }
>(
  f: (b: B) => Validation<A, P>,
  bs: B[],
  n: N = 0 as any
): Validation<A, MapArray<P>> {
  return mapM(f, bs).map(x => unzip(x, n));
}

/**
 * Reads two input arrays in-order and produces a [[Validation]] for each pair,
 * then aggregates the results or failures.
 *
 * @param f A function to combine each element of the input arrays in-order into a [[Validation]].
 * @param bs An input array.
 * @param params Additional arrays to zip.
 */
function zipWithM<A extends object | any[], B, P extends any[], C>(
  f: (b: B, ...params: P) => Validation<A, C>,
  bs: B[],
  ...params: MapArray<P>
): Validation<A, C[]> {
  return sequence(bs.zipWith(f, ...(params as any)));
}
