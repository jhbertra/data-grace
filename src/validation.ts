export {
    IValidation,
    IValidationCaseScrutinizer,
    IValidationInvalid,
    IValidationValid,
    Validation,
    MapValidation,
    Valid,
    Invalid,
    build,
    failures,
    forM,
    lift,
    mapAndUnzipWith,
    mapM,
    sequence,
    successful,
    zipWithM,
};

import { MapArray, unzip } from "./array";
import { Either, Left, Right } from "./either";
import { Just, Maybe, Nothing } from "./maybe";
import { constant, id, objectFromEntries, objectToEntries } from "./prelude";

/*------------------------------
  DATA TYPES
  ------------------------------*/

/**
 * The public methods exposed by the @see Validation type.
 */
interface IValidation<A extends object | any[], B> {

    /**
     * Extract the value of this @see Validation if it is @see Valid, or default to b.
     *
     * @example
     *
     *      Valid("foo").defaultWith("bar"); // "foo"
     *      Left(["error"]).defaultWith("bar"); // "bar"
     */
    defaultWith(b: B): B;

    /**
     * A type guard which determines if this @see Validation is a @see Invalid
     *
     * @example
     *
     *      const result = Invalid({ failure: "error" });
     *      if (result.isInvalid()) {
     *          result.failure; // { failure: "error" };
     *      }
     */
    isInvalid(): this is IValidationInvalid<A>;

    /**
     * A type guard which determines if this @see Validation is a @see Valid
     *
     * @example
     *
     *      const result = Valid("Bob");
     *      if (result.isValid()) {
     *          result.value; // "Bob";
     *      }
     */
    isValid(): this is IValidationValid<B>;

    /**
     * Modify the data in the @see Valid case.
     *
     * @example
     *
     *     Valid("bob").map(name => name.toUpperCase()).toString(); // "Valid (BOB)"
     *     Invalid(["error"]).map(name => name.toUpperCase()).toString(); // "Invalid (["error"])"
     */
    map<C>(f: (b: B) => C): Validation<A, C>;

    /**
     * Modify the data in the @see Invalid case.
     *
     * @example
     *
     *     Valid("bob").mapError(es => es.map(x => x.toUpperCase())).toString(); // "Valid (bob)"
     *     Invalid(["error"]).mapError(es => es.map(x => x.toUpperCase())).toString(); // "Invalid (["ERROR"])"
     */
    mapError<C extends object | any[]>(f: (a: A) => C): Validation<C, B>;

    /**
     * Run a callback based on the case of the @see Validation
     *
     * @example
     *
     *      Valid("bob").matchCase({
     *          invalid: x => x.length > 0 ? "Yes" : "No",
     *          valid: x => x.toUpperCase()); // "BOB"
     *
     *      Invalid([]).matchCase({
     *          invalid: x => x.length > 0 ? "Yes" : "No",
     *          valid: x => x.toUpperCase()); // "No"
     */
    matchCase<C>(cases: IValidationCaseScrutinizer<A, B, C>): C;

    /**
     * Pick this @see Validation if it is @see Valid otherwise pick the other.
     *
     * @example
     *
     *     Valid("bob").or(() => Valid("sue")).toString(); // "Valid (bob)"
     *     Invalid([false]).or(() => Valid("sue")).toString(); // "Valid (sue)"
     *     Invalid([false]).or(() => Invalid([true])).toString(); // "Invalid ([true])"
     */
    or(other: () => Validation<A, B>): Validation<A, B>;

    /**
     * If this @see Validation is @see Valid replace it with a different @see Validation.
     *
     * Aggregates errors.
     *
     * @example
     *
     *     Valid("bob").replace(Valid("sue")).toString(); // "Valid (sue)"
     *     Valid("bob").replace(Invalid([true])).toString(); // "Invalid ([true])"
     *     Invalid([false]).replace(Valid("sue")).toString(); // "Invalid ([false])"
     *     Invalid([false]).replace(Invalid([true])).toString(); // "Invalid ([false, true])"
     */
    replace<C>(m: Validation<A, C>): Validation<A, C>;

    /**
     * If this @see Validtion is @see Valid replace it with a pure value.
     *
     * @example
     *
     *     Valid("bob").replace(42).toString(); // "Valid (42)"
     *     Invalid([false]).replace(42).toString(); // "Invalid ([false])"
     */
    replacePure<C>(c: C): Validation<A, C>;

    /**
     * Convert this @see Validation to an array with either one or
     * zero elements.
     *
     * @example
     *
     *     Valid("bob").toArray(); // ["bob"]
     *     Invalid(["error"]).toArray(); // []
     */
    toArray(): B[];

    /**
     * Convert this @see Validation to an @see Either.
     */
    toEither(): Either<A, B>;

    /**
     * Convert this @see Validation to a @see Maybe.
     */
    toMaybe(): Maybe<B>;

    /**
     * Pretty-print this @see Validation
     */
    toString(): string;

    /**
     * Discard any value contained by this @see Validation
     */
    voidOut(): Validation<A, []>;
}

/**
 * Defines the set of functions required to scrutinize the cases of a @see Validation.
 */
interface IValidationCaseScrutinizer<A extends object | any[], B, C> {
    /**
     * Callback which is called in the case of @see Invalid.
     */
    invalid: (a: A) => C;

    /**
     * Callback which is called in the case of @see Valid.
     */
    valid: (b: B) => C;
}

/**
 * The type of an object constructed using the @see Invalid case.
 */
interface IValidationInvalid<A extends object | any[]> { readonly tag: "Invalid"; readonly failure: A; }

/**
 * The type of an object constructed using the @see Valid case.
 */
interface IValidationValid<B> { readonly tag: "Valid"; readonly value: B; }

/**
 * A data type that represents a calculation which can fail. The primary
 * difference between @see Validation and @see Either is that @see Validation
 * aggregates failures where it can. Its combinators are defined in such a
 * way that failures will accumulate, and as a consequence it is not possible
 * to do sequential validation with chain like one would do with @see Either.
 */
type Validation<A extends object | any[], B> = (IValidationInvalid<A> | IValidationValid<B>) & IValidation<A, B>;

/**
 * A type transformer that homomorphically maps the @see Validation type
 * onto the types of A.
 */
type MapValidation<A extends object | any[], B> = { [K in keyof B]: Validation<A, B[K]> };

/*------------------------------
  CONSTRUCTORS
  ------------------------------*/

/**
 * Constructs a new @see Validation that represents a valid
 * result.
 */
function Valid<A extends object | any[], B>(value: B): Validation<A, B> {
    return Object.freeze({
        defaultWith: constant(value),
        isInvalid() { return false; },
        isValid() { return true; },
        map(f) { return Valid(f(value)); },
        mapError() { return this; },
        matchCase({ valid }) { return valid(value); },
        or() { return this; },
        replace: id,
        replacePure: Valid,
        tag: "Valid",
        toArray() { return [value]; },
        toEither() { return Right<A, B>(value); },
        toMaybe() { return Just<B>(value); },
        toString() { return `Valid (${value})`; },
        value,
        voidOut() { return Valid<A, []>([]); },
    }) as Validation<A, B>;
}

/**
 * Constructs a new @see Validation that represents an invalid
 * result.
 */
function Invalid<A extends object | any[], B>(failure: A): Validation<A, B> {
    return Object.freeze({
        defaultWith: id,
        failure,
        isInvalid() { return true; },
        isValid() { return false; },
        map() { return this; },
        mapError(f) { return Invalid(f(failure)); },
        matchCase({ invalid }) { return invalid(failure); },
        or(x) { return x(); },
        replace(x) {
            return build<A, { a: B, b: typeof x extends Validation<A, infer C> ? C : never }>({
                a: this,
                b: x,
            });
        },
        replacePure() { return this; },
        tag: "Invalid",
        toArray() { return []; },
        toEither() { return Left<A, B>(failure); },
        toMaybe() { return Nothing<B>(); },
        toString() { return `Invalid (${failure})`; },
        voidOut() { return Invalid<A, []>(failure); },
    }) as Validation<A, B>;
}

/*------------------------------
  VALIDATION FUNCTIONS
  ------------------------------*/

/**
 * return a collection of all the failures in the list of validations.
 */
function failures<A extends object | any[], B>(vs: Array<Validation<A, B>>): A[] {
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
 */
function successful<A extends object | any[], B>(es: Array<Validation<A, B>>): B[] {
    const result: B[] = [];
    for (const validation of es) {
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
 * if they are all @see Valid
 *
 * @example
 *
 *      function answerTrueFalse(question: string, answer: boolean): string {
 *          return `${question} ${answer}`;
 *      }
 *
 *      lift(answerTrueFalse, Invalid(["error1"]), Invalid(["error2"])).toString(); // "Invalid (["error1", "error2"])"
 *      // "Invalid (["error2"])"
 *      lift(answerTrueFalse, Valid("The meaning of life is 42."), Invalid(["error2"])).toString();
 *      // "Valid (The meaning of life is 42. true)"
 *      lift(answerTrueFalse, Valid("The meaning of life is 42."), Valid(true)).toString();
 */
function lift<A extends object | any[], P extends any[], R>(
    f: (...args: P) => R,
    ...args: MapValidation<A, P>): Validation<A, R> {

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
 * Composes an @see Validation by constructing an object out of
 * multiple @see Validations. If all the components are @see Valid,
 * The object will be constructed, otherwise the first error will
 * be returned.
 *
 * @example
 *
 *      type Foo = { bar: string, baz: Maybe<boolean> };
 *
 *      // Left ({ bar: "invalid", baz: "invalid" })
 *      build<object, Foo>({
 *          bar: Invalid({ bar: "invalid" }),
 *          baz: Invalid({ baz: "invalid" })
 *      });
 *
 *      // Left ({ baz: "invalid" })
 *      build<object, Foo>({
 *          bar: Valid("BAR"),
 *          baz: Invalid({ baz: "invalid" })
 *      });
 *
 *      // Valid ({ bar: "BAR", baz: { tag: "Just", value: "baz" } })
 *      build<object, Foo>({
 *          bar: Valid("BAR"),
 *          baz: Valid(Just("baz"))
 *      });
 */
function build<A extends object | any[], T extends object>(spec: MapValidation<A, T>): Validation<A, T> {
    const kvpValidation = sequence(objectToEntries(spec).map(
        ([key, value]) => value.map((x) => [key, x] as [keyof T, T[typeof key]])));

    return kvpValidation.map(objectFromEntries);
}

/*------------------------------
  KLIESLI COMPOSITION FUNCTIONS
  ------------------------------*/

/**
 * Maps a function over an array of inputs and produces an @see Validation for each,
 * then aggregates the results or failures inside of an @see Validation.
 */
function mapM<A extends object | any[], B, C>(f: (value: B) => Validation<A, C>, bs: B[]): Validation<A, C[]> {
    return sequence(bs.map(f));
}

/**
 * @see mapM with its arguments reversed.
 */
function forM<A extends object | any[], B, C>(bs: B[], f: (value: B) => Validation<A, C>): Validation<A, C[]> {
    return mapM(f, bs);
}

/**
 * Aggregate a sequence of @see Validations and combine their results or failures.
 */
function sequence<A extends object | any[], B>(vbs: Array<Validation<A, B>>): Validation<A, B[]> {
    return lift((...bs: B[]) => bs, ...vbs);
}

/**
 * Maps a decomposition of parts over an array of inputs.
 * @param f A decomposition function
 * @param as An array of inputs
 */
function mapAndUnzipWith<A extends object | any[], N extends number, B, P extends any[] & { length: N }>(
    n: N,
    f: (b: B) => Validation<A, P>,
    bs: B[]): Validation<A, MapArray<P>> {

    return mapM(f, bs).map((x) => unzip(n, x));
}

/**
 * Reads two input arrays in-order and produces an @see Validation for each pair,
 * then aggregates the results or failures.
 */
function zipWithM<A extends object | any[], B, P extends any[], C>(
    f: (b: B, ...params: P) => Validation<A, C>,
    bs: B[],
    ...params: MapArray<P>): Validation<A, C[]> {

    return sequence(bs.zipWith(f, ...params as any));
}
