export {
    IDecoder,
    DecodeError,
    Decoder,
    MapDecoder,
    array,
    boolean,
    constant,
    constantFailure,
    date,
    forM,
    id,
    lift,
    build,
    makeDecoder,
    mapAndUnzipWith,
    mapM,
    number,
    object,
    oneOf,
    only,
    optional,
    property,
    sequence,
    string,
    tuple,
    zipWithM,
};

import { unzip, zipWith } from "./array";
import { Just, Maybe, Nothing } from "./maybe";
import { id as preludeId, objectFromEntries, objectToEntries } from "./prelude";
import { Validation } from "./validation";
import * as V from "./validation";

/*------------------------------
  DATA TYPES
  ------------------------------*/

/**
 * The public methods exposed by the @see Decoder type.
 */
interface IDecoder<TIn, A> {

    /**
     * Apply a transformation to all data produced by this @see Decoder.
     */
    map<B>(f: (c: A) => B): Decoder<TIn, B>;

    /**
     * Make a @see Decoder that first tries to run this @see Decoder,
     * falling back on another if it fails.
     */
    or(other: Decoder<TIn, A>): Decoder<TIn, A>;

    /**
     * Replace all successfully decoded values with a new decoder.
     */
    replace<B>(m: Decoder<TIn, B>): Decoder<TIn, B>;

    /**
     * Replace all successfully decoded values with a new value.
     */
    replacePure<B>(c: B): Decoder<TIn, B>;

    /**
     * Discard any output this @see Decoder produces.
     */
    voidOut(): Decoder<TIn, []>;
}

/**
 * A dictionary of data paths to error messages.
 */
// tslint:disable-next-line: interface-over-type-literal
type DecodeError = { [id: string]: string };

/**
 * A decoder is a conversion function that converts from a raw data format
 * to a more abstract one. The conversion may fail.
 */
type Decoder<TIn, A> = { decode: (input: TIn) => Validation<DecodeError, A> } & IDecoder<TIn, A>;

/**
 * A type transformer that homomorphically maps the @see Decoder
 * onto the types of A.
 *
 * @example
 *
 *      // Map the fields of an object
 *      type Foo = { bar: number, baz: string };
 *
 *      // Write a type test
 *      type PropEquality =
 *          MapDecoder<string, Foo> extends { bar: Decoder<string, number>, baz: Decoder<string, string> }
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
 *      type PropEquality = MapDecoder<string, Foo> extends Decoder<string, string>[] ? any : never;
 *
 *       // Witness the proof of the proposition (compiles)
 *      const proof : PropEquality = "witness"
 */
type MapDecoder<TIn, A> = { [K in keyof A]: Decoder<TIn, A[K]> };

/*------------------------------
  CONSTRUCTORS
  ------------------------------*/

/**
 * Creates a Decoder that runs the given decoding function.
 */
function makeDecoder<TIn, A>(decode: (input: TIn) => Validation<DecodeError, A>): Decoder<TIn, A> {
    return Object.freeze({
        decode,
        map(f) { return makeDecoder((x) => decode(x).map(f)); },
        or(d) { return makeDecoder((x) => decode(x).or(() => d.decode(x))); },
        replace(d) { return makeDecoder((x) => decode(x).replace(d.decode(x))); },
        replacePure(f) { return makeDecoder((x) => decode(x).replacePure(f)); },
        voidOut() { return makeDecoder<TIn, []>((x) => decode(x).voidOut()); },
    }) as Decoder<TIn, A>;
}

/*------------------------------
  GENERAL-PURPOSE DECODERS
  ------------------------------*/

function prefixError(prefix: string, error: DecodeError): DecodeError {
    return objectFromEntries(
        objectToEntries(error)
            .map(([childError, message]) => {
                const suffix = childError === "$"
                    ? ""
                    : (childError as string).startsWith("[")
                        ? childError
                        : `.${childError}`;

                return [`${prefix}${suffix}`, message];
            }));
}

/**
 * Always returns t as a valid result.
 */
function constant<T>(t: T): Decoder<any, T> {
    return makeDecoder(() => V.Valid(t));
}

/**
 * Always decodes the input.
 */
const id: Decoder<any, any> = makeDecoder(V.Valid);

/**
 * Always returns t as a failed result.
 */
function constantFailure<T>(failure: DecodeError): Decoder<any, T> {
    return makeDecoder(() => V.Invalid(failure));
}

/**
 * Conversion from unknown data to dates.
 *
 * @example
 *
 *      date.decode(true); // Invalid ({"$": "Expected a date"})
 *      date.decode("2019-07-26"); // Valid (Fri Jul 26 2019 00:00:00 GMT-0000 (UTC))
 *      date.decode(Date.parse("2019-07-26")); // Valid (Fri Jul 26 2019 00:00:00 GMT-0000 (UTC))
 */
const date: Decoder<any, Date> = makeDecoder((value: any) => {
    if (value instanceof Date) {
        return V.Valid(value);
    } else if (typeof(value) === "string" && value.match(/^[0-9\s]+$/) == null) {
        const parsed = Date.parse(value);
        return Number.isNaN(parsed)
            ? V.Invalid({ $: "Expected a date" } as DecodeError)
            : V.Valid(new Date(parsed));
    } else {
        return V.Invalid({ $: "Expected a date" } as DecodeError);
    }
});

/**
 * Conversion from unknown data to booleans.
 *
 * @example
 *
 *      boolean.decode(true); // Valid (true)
 *      boolean.decode("true"); // Invalid ({"$": "Expected a boolean"})
 */
// tslint:disable-next-line: variable-name
const boolean: Decoder<any, boolean> = makeDecoder(
    (value: any) => typeof (value) === "boolean"
        ? V.Valid(value)
        : V.Invalid({ $: "Expected a boolean" } as DecodeError));

/**
 * Conversion from unknown data to numbers.
 *
 * @example
 *
 *      number.decode(1); // Valid (1)
 *      number.decode("1"); // Invalid ({"$": "Expected a number"})
 */
// tslint:disable-next-line: variable-name
const number: Decoder<any, number> = makeDecoder(
    (value: any) => typeof (value) === "number"
        ? V.Valid(value)
        : V.Invalid({ $: "Expected a number" } as DecodeError));

/**
 * Conversion from unknown data to strings.
 *
 * @example
 *
 *      string.decode(null); // Invalid ({"$": "Expected a string"})
 *      string.decode("foo"); // Valid ("foo")
 */
// tslint:disable-next-line: variable-name
const string: Decoder<any, string> = makeDecoder(
    (value: any) => typeof (value) === "string"
        ? V.Valid(value)
        : V.Invalid({ $: "Expected a string" } as DecodeError));

/**
 * Conversion from unknown data to arrays.
 *
 * @example
 *
 *      array(string).decode("foo"); // Invalid ({"$": "Expected an array"})
 *      array(string).decode([true, "foo"]); // Invalid ({"[0]": "Expected a string"})
 *      array(string).decode(["foo"]); // Valid (["foo"])
 */
function array<T>(convert: Decoder<any, T>): Decoder<any, T[]> {
    return makeDecoder((value) => Array.isArray(value)
        ? V.sequence(value.map((x, i) => convert.decode(x).mapError((error) => prefixError(`[${i}]`, error))))
        : V.Invalid({ $: "Expected an array" } as DecodeError));
}

/**
 * Conversion from unknown data to a finite set of values.
 *
 * @example
 *
 *      oneOf(only("foo"), only("bar")).decode("foo"); // Valid ("foo")
 *      oneOf(only("foo"), only("bar")).decode("bar"); // Valid ("bar")
 *      oneOf(only("foo"), only("bar")).decode("baz"); // Invalid ({"$": "Expected bar"})
 */
function oneOf<T>(firstChoice: Decoder<any, T>, ...choices: Array<Decoder<any, T>>): Decoder<any, T> {
    return choices.reduce((state, d) => state.or(d), firstChoice);
}

/**
 * Conversion from unknown data to a single valid value.
 *
 * @example
 *
 *      only("foo").decode("foo"); // Valid ("foo")
 *      only("foo").decode("bar"); // Invalid ({"$": "Expected foo"})
 */
function only<T>(value: T): Decoder<any, T> {
    return makeDecoder((x) => x === value ? V.Valid(x) : V.Invalid({ $: `Expected ${value}` }));
}

/**
 * Conversion from unknown data to optional types.
 *
 * @example
 *
 *      optional(string).decode(null); // Valid (Nothing)
 *      optional(string).decode(unknown); // Valid (Nothing)
 *      optional(string).decode("foo"); // Valid (Just (foo))
 *      optional(string).decode(true); // Invalid ({"$": "Expected a string"})
 */
function optional<T>(convert: Decoder<any, T>): Decoder<any, Maybe<T>> {
    return makeDecoder(
        (value) => value === null || value === undefined ? V.Valid(Nothing()) : convert.decode(value).map(Just));
}

/**
 * Conversion from general objects to specific object types.
 *
 * @example
 *
 *      type Foo = { bar: string };
 *
 *      const fooDecoder = build<Foo>({
 *          bar: property("bar": string)
 *      });
 *
 *      object(fooDecoder).decode({ bar: "foo" }); // Valid ({ bar: "foo" })
 *      object(fooDecoder).decode({ bar: true }); // Invalid ({"bar", "Expected a string"})
 *      object(fooDecoder).decode({ qux: "foo" }); // Invalid ({"bar", "Required"]]
 *      object(fooDecoder).decode("foo"); // Invalid ({"$": "Expected an object"})
 */

function object<T extends object>(convert: Decoder<object, T>): Decoder<any, T> {
    return makeDecoder(
        (value) => typeof (value) === "object" && value !== null
            ? convert.decode(value)
            : V.Invalid({ $: "Expected an object" } as DecodeError));
}

/**
 * Decodes properties of an object.
 *
 * @example
 *
 *      property("bar", string).decode({}); // Invalid ({"bar", "Expected a string"})
 *      property("bar", string).decode({ bar: true}); // Invalid ({"bar", "Expected a string"})
 *      property("bar", string).decode({ bar: "foo"}); // Valid ("foo")
 */
function property<T>(
    name: string,
    convert: Decoder<any, T>): Decoder<object, T> {
    return makeDecoder((obj) => convert
        .decode((obj as any)[name])
        .mapError((error) => prefixError(name, error)));
}

/**
 * Conversion from unknown data to tuples.
 *
 * @example
 *
 *      tuple(string, number).decode("foo"); // Invalid ({"$": "Expected an array"})
 *      tuple(string, number).decode([1, "foo"]); // Invalid ({"[0]": "Expected a string", "[1]": "Expected a number"})
 *      tuple(string, number).decode(["foo", 1]); // Valid (["foo", 1])
 */

function tuple<T extends any[]>(...converters: MapDecoder<any, T>): Decoder<any, T> {
    return makeDecoder((value) => Array.isArray(value)
        ? value.length === converters.length
            ? V.zipWithM(
                (x, [converter, i]) => converter.decode(x).mapError((error) => prefixError(`[${i}]`, error)),
                value,
                converters.map(
                    (x, i) => [x, i] as [Decoder<any, T[keyof T]>, number])) as unknown as Validation<DecodeError, T>
            : V.Invalid({ $: `Expected an array of length ${converters.length}` } as DecodeError)
        : V.Invalid({ $: `Expected an array of length ${converters.length}` } as DecodeError));
}

/*------------------------------
  GENERAL LIFTING FUNCTIONS
  ------------------------------*/

/**
 * Composes a decoder that decodes all the arguments of a
 * function and applies the function to its decoded arguments.
 *
 * @example
 *
 *      function answerTrueFalse(question: string, answer: boolean): string {
 *          return `${question} ${answer}`;
 *      }
 *
 *      const decodeAnswerTrueFalse: Decoder<object, string> = lift(
 *          answerTrueFalse,
 *          property("question", string),
 *          property("answer", boolean))
 *
 *      decodeAnswerTrueFalse.decode({ question: "asdf", answer: true }); // Valid (asdf true)
 *      decodeAnswerTrueFalse.decode({ question: "asdf", answer: 0 }); // Invalid ({"answer": "Expected a boolean"})
 */
function lift<TIn, P extends any[], R>(f: (...args: P) => R, ...args: MapDecoder<TIn, P>): Decoder<TIn, R> {
    return sequence(args).map((a) => f.apply(undefined, a as P));
}

/**
 * Composes a decoder that decodes an object into an instance of
 * T out of decoders which decode the constituent components. It
 * "lifts" the structure of an object into a decoder.
 *
 * @example
 *
 *      type Foo = { bar: string, baz: Maybe<boolean> };
 *
 *      const fooDecoder: Decoder<object, Foo> = build<Foo>({
 *          bar: property("bar", string),
 *          baz: property("baz", optional(boolean))
 *      });
 *
 *      fooDecoder.decode({ bar: null, baz: 1 }); // Invalid ({"bar": "Required", "baz": "Expected a boolean"})
 *      // Valid ({ "bar": "eek", "baz": { "tag": "Just", "value": false } })
 *      fooDecoder.decode({ bar: "eek", baz: false });
 *      fooDecoder.encode({ bar: "eek", baz: Just(false) }); // { bar: "eek", baz: false }
 */
function build<T extends object>(spec: MapDecoder<object, T>): Decoder<object, T> {
    const maybeKvps = sequence(objectToEntries(spec).map(
        ([key, value]) => value.map((x) => [key, x] as [keyof T, T[typeof key]])));

    return maybeKvps.map(objectFromEntries);
}

/*------------------------------
  KLIESLI-COMPOSITION FUNCTIONS
  ------------------------------*/

/**
 * Maps a function over an array of inputs and produces a decoder for each.
 * @param f A function that produces a new decoder for each input
 * @param as A set of inputs to map over
 */
function mapM<TIn, A, B>(f: (value: A) => Decoder<TIn, B>, as: A[]): Decoder<TIn, B[]> {
    return makeDecoder((x) => V.mapM((a) => f(a).decode(x), as));
}

/**
 * @see mapM with its arguments reversed.
 */
function forM<TIn, A, B>(as: A[], f: (value: A) => Decoder<TIn, B>): Decoder<TIn, B[]> {
    return mapM(f, as);
}

/**
 * Runs a sequence of decoders and aggregates their results.
 * @param das A sequence of decoders to run.
 */
function sequence<TIn, A>(das: Array<Decoder<TIn, A>>): Decoder<TIn, A[]> {
    return mapM(preludeId, das);
}

/**
 * Maps a decomposition of parts over an array of inputs.
 * @param f A decomposition function
 * @param as An array of inputs
 */
function mapAndUnzipWith<TIn, A, B, C>(f: (a: A) => Decoder<TIn, [B, C]>, as: A[]): Decoder<TIn, [B[], C[]]> {
    return mapM(f, as).map(unzip);
}

/**
 * Reads two input arrays in-order and produces a decoder for each pair,
 * then aggregates the results.
 * @param f A function that merges two inputs into a decoder
 * @param as The first set of inputs
 * @param bs The second set of inputs
 */
function zipWithM<TIn, A, B, C>(f: (a: A, b: B) => Decoder<TIn, C>, as: A[], bs: B[]): Decoder<TIn, C[]> {
    return sequence(zipWith(f, as, bs));
}
