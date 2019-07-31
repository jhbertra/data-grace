export {
    IValidation,
    IValidationInvalid,
    IValidationValid,
    Validation,
    MapValidation,
    Valid,
    Invalid,
    failures,
    forM,
    liftF,
    liftO,
    mapAndUnzipWith,
    mapM,
    sequence,
    successful,
    zipWithM,
};

import {unzip, zipWith} from "./array";
import { Either, Left, Right } from "./either";
import { Just, Maybe, Nothing } from "./maybe";
import {constant, id, objectFromEntries, objectToEntries} from "./prelude";

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
interface IValidationValid<B> { readonly tag: "Valid";  readonly value: B; }

/**
 * A data type that represents a calculation which can fail. The primary
 * difference between @see Validation and @see Either is that @see Validation
 * aggregates failures where it can. Its combinators are defined in such a
 * way that failures will accumulate, and as a consequence it is not possible
 * to do sequential validation with flatMap like one would do with @see Either.
 */
type Validation<A extends object | any[], B> = (IValidationInvalid<A> | IValidationValid<B>) & IValidation<A, B>;

/**
 * A type transformer that homomorphically maps the @see Validation type
 * onto the types of A.
 *
 * @example
 *
 *      // Map the fields of an object
 *      type Foo = { bar: number, baz: string };
 *
 *      // Write a type test that proposes type equality
 *      type PropEquality =
 *          MapValidation<any[], Foo> extends { bar: Validation<any[], number>, baz: Validation<any[], string> }
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
 *          MapValidation<any[], Foo> extends Validation<any[], string>[]
 *              ? any
 *              : never;
 *
 *      // Witness the proof of the proposition (compiles)
 *      const proof : PropEquality = "witness"
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
    return  Object.freeze({
        defaultWith: constant(value),
        isInvalid: () => false,
        isValid: () => true,
        map: (f) => Valid(f(value)),
        mapError: (_) => Valid(value),
        matchCase: ({valid}) => valid(value),
        or: (_) => Valid(value),
        replace: id,
        replacePure: Valid,
        tag: "Valid",
        toArray: () => [value],
        toEither: () => Right<A, B>(value),
        toMaybe: () => Just<B>(value),
        toString: () => `Valid (${value})`,
        value,
        voidOut: () => Valid<A, []>([]),
    }) as Validation<A, B>;
}

/**
 * Constructs a new @see Validation that represents an invalid
 * result.
 */
function Invalid<A extends object | any[], B>(failure: A): Validation<A, B> {
    return  Object.freeze({
        defaultWith: id,
        failure,
        isInvalid: () => true,
        isValid: () => false,
        map: (_) => Invalid(failure),
        mapError: (f) => Invalid(f(failure)),
        matchCase: ({invalid}) => invalid(failure),
        or: (x) => x(),
        replace(x) { return liftF((_, x1) => x1, this, x); },
        replacePure: (_) => Invalid(failure),
        tag: "Invalid",
        toArray: () => [],
        toEither: () => Left<A, B>(failure),
        toMaybe: () => Nothing<B>(),
        toString: () => `Invalid (${failure})`,
        voidOut: () => Invalid<A, []>(failure),
    }) as Validation<A, B>;
}

/*------------------------------
  VALIDATION FUNCTIONS
  ------------------------------*/

/**
 * return a collection of all the failures in the list of validations.
 */
function failures<A extends object | any[], B>(es: Array<Validation<A, B>>): A[] {
    return es.reduce(
        (state, m) => [...state, ...m.matchCase({invalid: (x) => [x], valid: () => []})],
         [] as A[]);
}

/**
 * return a collection of all the successes in the list of validations.
 */
function successful<A extends object | any[], B>(es: Array<Validation<A, B>>): B[] {
    return es.reduce(
        (state, m) => [...state, ...m.matchCase({invalid: () => [], valid: (x) => [x]})],
         [] as B[]);
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
 *      liftF(answerTrueFalse, Invalid(["error1"]), Invalid(["error2"])).toString(); // "Invalid (["error1", "error2"])"
 *      // "Invalid (["error2"])"
 *      liftF(answerTrueFalse, Valid("The meaning of life is 42."), Invalid(["error2"])).toString();
 *      // "Valid (The meaning of life is 42. true)"
 *      liftF(answerTrueFalse, Valid("The meaning of life is 42."), Valid(true)).toString();
 */
function liftF<A extends object | any[], P extends any[], R>(
    f: (...args: P) => R,
    ...args: MapValidation<A, P>): Validation<A, R> {
    const errors = failures(args);

    return errors.length === 0
        ? Valid(f.apply(undefined,  successful(args) as P))
        : Array.isArray(errors[0])
            ? Invalid(errors.reduce((a, b) => [...a as any[], ...b as any[]],  [] as any[]) as A)
            : Invalid(errors.reduce((a, b) => ({...a, ...b}),  {} as A));
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
 *      liftO<object, Foo>({
 *          bar: Invalid({ bar: "invalid" }),
 *          baz: Invalid({ baz: "invalid" })
 *      });
 *
 *      // Left ({ baz: "invalid" })
 *      liftO<object, Foo>({
 *          bar: Valid("BAR"),
 *          baz: Invalid({ baz: "invalid" })
 *      });
 *
 *      // Valid ({ bar: "BAR", baz: { tag: "Just", value: "baz" } })
 *      liftO<object, Foo>({
 *          bar: Valid("BAR"),
 *          baz: Valid(Just("baz"))
 *      });
 */
function liftO<A extends object | any[], T extends object>(spec: MapValidation<A, T>): Validation<A, T> {
    const kvpValidation = sequence(objectToEntries(spec).map(
        ([key, value]) => value.map((x) =>  [key, x] as [keyof T, T[typeof key]])));

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
    return liftF((...bs: B[]) => bs, ...vbs);
}

/**
 * Maps a decomposition of parts over an array of inputs.
 * @param f A decomposition function
 * @param as An array of inputs
 */
function mapAndUnzipWith<A extends object | any[], B, C, D>(
    f: (a: B) => Validation<A, [C, D]>,
    bs: B[]): Validation<A, [C[], D[]]> {
    return mapM(f, bs).map(unzip);
}

/**
 * Reads two input arrays in-order and produces an @see Validation for each pair,
 * then aggregates the results or failures.
 */
function zipWithM<A extends object | any[], B, C, D>(
    f: (b: B, c: C) => Validation<A, D>,
    bs: B[],
    cs: C[]): Validation<A, D[]> {
    return sequence(zipWith(f, bs, cs));
}
