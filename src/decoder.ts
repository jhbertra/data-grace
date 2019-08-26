export {
    Decoder,
    DecodeError,
    MapDecoder,
    $case,
    array,
    boolean,
    build,
    constant,
    constantFailure,
    forM,
    id,
    lift,
    makeDecoder,
    mapAndUnzipWith,
    mapM,
    number,
    oneOf,
    only,
    optional,
    property,
    sequence,
    string,
    tuple,
    zipWithM,
};

import { MapArray, unzip } from "./array";
import { Just, Maybe, Nothing } from "./maybe";
import { Case, id as preludeId, objectFromEntries, objectToEntries } from "./prelude";
import { Validation } from "./validation";
import * as V from "./validation";

/*------------------------------
  DATA TYPES
  ------------------------------*/

/**
 * The public methods exposed by the [[Decoder]] type.
 */
interface Decoder<TIn, A> {

    /**
     * Apply a transformation to all input by this [[Decoder]].
     *
     * ```ts
     * string.contramap(s => s === "BOB" ? "sue" : "bab").decode("sue").toString(); // "Valid (bob)"
     * string.contramap(s => s === "BOB" ? "sue" : "bab").decode(12).toString(); // "Valid (sue)"
     * ```
     *
     * @param f a function that modifies values read by this [[Decoder]].
     * @returns an [[Decoder]] that transforms its values.
     */
    contramap<TIn2>(f: (tin: TIn2) => TIn): Decoder<TIn2, A>;

    /**
     * Try to convert `input` to an instance of `A`
     * @param input The raw input to decode.
     * @returns A [[Validation]] possibly containing a decoded value.
     */
    decode(input: TIn): Validation<DecodeError, A>;

    /**
     *  Transform both the input and the output of this [[Decoder]].
     *
     * ```ts
     * string.dimap(f, g);
     * // equivalent to
     * string.contramap(f).map(g);
     * ```
     *
     * @param f a function that modifies values read by this [[Decoder]].
     * @param g a function that modifies values decoded by this [[Decoder]].
     * @returns an [[Decoder]] that transforms its input and output.
     */
    dimap<TIn2, B>(f: (tin: TIn2) => TIn, g: (a: A) => B): Decoder<TIn2, B>;

    /**
     * Apply a transformation to all data produced by this [[Decoder]].
     *
     * ```ts
     * string.map(s => s.toUpperCase()).decode("bob").toString(); // "Valid (BOB)"
     * string.map(s => s.toUpperCase()).decode(12).toString(); // "Invalid ({ $: "Expected a string" })"
     * ```
     *
     * @param f a function that modifies values decoded by this [[Decoder]].
     * @returns an [[Decoder]] that transforms its values.
     */
    map<B>(f: (c: A) => B): Decoder<TIn, B>;

    /**
     * Make an [[Decoder]] that first tries to run this [[Decoder]],
     * falling back on another if it fails.
     *
     * ```ts
     * string.or(number).decode("foo"); // "Valid (foo)"
     * string.or(number).decode(12); // "Valid (12)"
     * string.or(number).decode(false); // "Invalid ({ $: "Expected a number" })"
     * ```
     *
     * @param other an [[Decoder]] to chose if this one fails.
     * @returns an [[Decoder]] which if `this` decodes, chooses the decoded value, else runs `other`.
     */
    or(other: Decoder<TIn, A>): Decoder<TIn, A>;

    /**
     * Replace all successfully decoded values with a new decoder.
     *
     * ```ts
     * const d = property("foo", string).replace(property("bar", number))
     * d.decode({ "foo": "test" }) // "Invalid ({ "bar": "Required" })"
     * d.decode({ "bar": 12 }) // "Invalid ({ "foo": "Required" })"
     * d.decode({}) // "Invalid ({ "foo": "Required", "bar": "Required" })"
     * d.decode({ "foo": "test", "bar": 12 }) // "Valid (12)"
     * ```
     *
     * @param m an [[Decoder]] to run if this one succeeds.
     * @returns an [[Decoder]] which runs `m` and replaces the value if both succeed.
     */
    replace<B>(m: Decoder<TIn, B>): Decoder<TIn, B>;

    /**
     * Replace all successfully decoded values with a new value.
     *
     * ```ts
     * const d = property("foo", string).replacePure(42)
     * d.decode({ "foo": 12 }) // "Invalid ({ "foo": "Expected a string" })"
     * d.decode({}) // "Invalid ({ "foo": "Required" })"
     * d.decode({ "foo": "test" }) // "Valid (42)"
     * ```
     *
     * @param b a value to replace successful results with.
     * @returns an [[Decoder]] which replaces successfully decoded values with `b`.
     */
    replacePure<B>(b: B): Decoder<TIn, B>;

    /**
     * Discard any output this [[Decoder]] produces.
     *
     * ```ts
     * string.voidOut().decode(12); // Invalid ({ $: "Expected a string" })
     * string.voidOut().decode("foo"); // Valid ([])
     * ```
     */
    voidOut(): Decoder<TIn, []>;
}

/**
 * A dictionary of data paths to error messages.
 */
// tslint:disable-next-line: interface-over-type-literal
type DecodeError = { [id: string]: string };

/**
 * A type transformer that homomorphically maps the [[Decoder]]
 * onto the types of A.
 *
 * ```ts
 * // Example = {a: Decoder<unknown, string>, b: Decoder<unknown, number>}
 * type Example = MapDecoder<unknown, {a: string, b: number}>
 * ```
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
        contramap(f) { return makeDecoder((x) => decode(f(x as any))); },
        dimap(f, g) { return makeDecoder((x) => decode(f(x as any)).map(g)); },
        map(f) { return makeDecoder((x) => decode(x).map(f)); },
        or(d) { return makeDecoder((x) => decode(x).or(d.decode(x))); },
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
 *
 * ```ts
 * constant("foo").decode(42); // Valid (foo)
 * ```
 *
 * @param t the value to return when decoding.
 * @returns a decoder that always returns `t`.
 */
function constant<T>(t: T): Decoder<any, T> {
    return makeDecoder(() => V.Valid(t));
}

/**
 * Always decodes the input.
 *
 * ```ts
 * id.decode(12); // Valid (12)
 * ```
 */
const id: Decoder<unknown, any> = makeDecoder(V.Valid);

/**
 * Always returns t as a failed result.
 *
 * ```ts
 * constantFailure({ foo: "bar" }).decode(42); // Invalid ({ foo: "bar" })
 * ```
 *
 * @param failure the error to return when decoding.
 * @returns a decoder that always returns `failure`.
 */
function constantFailure<T>(failure: DecodeError): Decoder<any, T> {
    return makeDecoder(() => V.Invalid(failure));
}

/**
 * Conversion from unknown data to booleans.
 *
 * ```ts
 * boolean.decode(true); // Valid (true)
 * boolean.decode("true"); // Invalid ({"$": "Expected a boolean"})
 * ```
 */
// tslint:disable-next-line: variable-name
const boolean: Decoder<unknown, boolean> = makeDecoder(
    (value: any) => typeof (value) === "boolean"
        ? V.Valid(value)
        : V.Invalid({ $: "Expected a boolean" } as DecodeError));

/**
 * Conversion from unknown data to numbers.
 *
 * ```ts
 * number.decode(1); // Valid (1)
 * number.decode("1"); // Invalid ({"$": "Expected a number"})
 * ```
 */
// tslint:disable-next-line: variable-name
const number: Decoder<unknown, number> = makeDecoder(
    (value: any) => typeof (value) === "number"
        ? V.Valid(value)
        : V.Invalid({ $: "Expected a number" } as DecodeError));

/**
 * Conversion from unknown data to strings.
 *
 * ```ts
 * string.decode(null); // Invalid ({"$": "Expected a string"})
 * string.decode("foo"); // Valid ("foo")
 * ```
 */
// tslint:disable-next-line: variable-name
const string: Decoder<unknown, string> = makeDecoder(
    (value: any) => typeof (value) === "string"
        ? V.Valid(value)
        : V.Invalid({ $: "Expected a string" } as DecodeError));

/**
 * Conversion from unknown data to arrays.
 *
 * ```ts
 * array(string).decode("foo"); // Invalid ({"$": "Expected an array"})
 * array(string).decode([true, "foo"]); // Invalid ({"[0]": "Expected a string"})
 * array(string).decode(["foo"]); // Valid (["foo"])
 * ```
 *
 * @param convert a decoder used to decode the values in the array.
 * @returns An [[Decoder]] that decodes arrays whose items can be decoded with `convert`.
 */
function array<T>(convert: Decoder<unknown, T>): Decoder<unknown, T[]> {
    return makeDecoder((value) => Array.isArray(value)
        ? V.sequence(value.map((x, i) => convert.decode(x).mapError((error) => prefixError(`[${i}]`, error))))
        : V.Invalid({ $: "Expected an array" } as DecodeError));
}

/**
 * Runs the decoder when the __case property matches.
 */
function $case<Tag extends string, TCase extends object, T extends Case<Tag> & TCase>(
    tag: Tag,
    convert?: Decoder<unknown, TCase>,
): Decoder<object, T> {
    return makeDecoder((input) => input.hasOwnProperty("__case") && (input as any).__case === tag
        ? (convert || constant({})).decode(input).map((x) => ({ ...x, __case: tag } as T))
        : V.Invalid({ $: `Expected __case: ${tag}`}));
}

/**
 * Conversion from unknown data to a finite set of values.
 *
 * ```ts
 * oneOf(only("foo"), only("bar")).decode("foo"); // Valid ("foo")
 * oneOf(only("foo"), only("bar")).decode("bar"); // Valid ("bar")
 * oneOf(only("foo"), only("bar")).decode("baz"); // Invalid ({"$": "Expected bar"})
 * ```
 *
 * @param firstChoice the first decoder to try.
 * @param choices additional decoders to try until one succeeds, or all fail.
 * @returns An [[Decoder]] which tries all decoders in sequence until one succeeds, or all fail.
 */
function oneOf<T>(...choices: Array<Decoder<unknown, T>>): Decoder<unknown, T> {
    return choices.reduce((state, d) => state.or(d), constantFailure({ $: "There are no valid choices." }));
}

/**
 * Conversion from unknown data to a single valid value.
 *
 * ```ts
 * only("foo").decode("foo"); // Valid ("foo")
 * only("foo").decode("bar"); // Invalid ({"$": "Expected foo"})
 * ```
 *
 * @param value the value to match.
 * @returns An [[Decoder]] that only permits `value`.
 */
function only<T>(value: T): Decoder<unknown, T> {
    return makeDecoder((x) => x === value ? V.Valid(x as T) : V.Invalid({ $: `Expected ${value}` }));
}

/**
 * Conversion from unknown data to optional types.
 *
 * ```ts
 * optional(string).decode(null); // Valid (Nothing)
 * optional(string).decode(unknown); // Valid (Nothing)
 * optional(string).decode("foo"); // Valid (Just (foo))
 * optional(string).decode(true); // Invalid ({"$": "Expected a string"})
 * ```
 *
 * @param convert an [[Decoder]] which converts values when they are not `null` or `undefined`
 * @returns An [[Decoder]] which can handle `null` and `undefined` by wrapping the result in a [[Maybe]].
 */
function optional<T>(convert: Decoder<unknown, T>): Decoder<unknown, Maybe<T>> {
    return makeDecoder(
        (value) => value === null || value === undefined ? V.Valid(Nothing()) : convert.decode(value).map(Just));
}

/**
 * Decodes properties of an object.
 *
 * ```ts
 * property("bar", string).decode({}); // Invalid ({"bar", "Expected a string"})
 * property("bar", string).decode({ bar: true}); // Invalid ({"bar", "Expected a string"})
 * property("bar", string).decode({ bar: "foo"}); // Valid ("foo")
 * ```
 *
 * @param name The name of the property to read.
 * @param convert The decoder to decode the property value.
 * @returns An [[Decoder]] which accepts an object and reads properties from it.
 */
function property<T>(
    name: string,
    convert: Decoder<unknown, T>): Decoder<object, T> {
    return makeDecoder((obj) => convert
        .decode((obj as any)[name])
        .mapError((error) => prefixError(name, error)));
}

/**
 * Conversion from unknown data to tuples.
 *
 * ```ts
 * tuple(string, number).decode("foo"); // Invalid ({"$": "Expected an array"})
 * tuple(string, number).decode([1, "foo"]); // Invalid ({"[0]": "Expected a string", "[1]": "Expected a number"})
 * tuple(string, number).decode(["foo", 1]); // Valid (["foo", 1])
 * ```
 *
 * @param converters a sequence of decoders that positionally decode tuple values.
 * @returns An [[Decoder]] which runs each converter in-order on an input array and produces a tuple.
 */

function tuple<T extends any[]>(...converters: MapDecoder<unknown, T>): Decoder<unknown, T> {
    return makeDecoder((value) => Array.isArray(value)
        ? value.length === converters.length
            ? V.zipWithM(
                (x, [converter, i]) => converter.decode(x).mapError((error) => prefixError(`[${i}]`, error)),
                value,
                converters.map(
                    (x, i) => [x, i] as [Decoder<unknown, T[keyof T]>, number])) as Validation<DecodeError, T>
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
 * ```ts
 * function answerTrueFalse(question: string, answer: boolean): string {
 *     return `${question} ${answer}`;
 * }
 *
 * const decodeAnswerTrueFalse: Decoder<object, string> = lift(
 *     answerTrueFalse,
 *     property("question", string),
 *     property("answer", boolean))
 *
 * decodeAnswerTrueFalse.decode({ question: "foo", answer: true }); // Valid (foo true)
 * decodeAnswerTrueFalse.decode({ question: "foo", answer: 0 }); // Invalid ({"answer": "Expected a boolean"})
 * ```
 *
 * @param f a function to lift to operate in [[Decoder]]s.
 * @param args lifted arguments to `f`.
 * @returns the result of evaluating `f` in an [[Decoder]] on the values produced by `args`.
 */
function lift<TIn, P extends any[], R>(f: (...args: P) => R, ...args: MapDecoder<TIn, P>): Decoder<TIn, R> {
    return makeDecoder((input) => {
        const values = [];
        const errors: DecodeError[] = [];
        for (const d of args) {
            const result = d.decode(input);
            if (result.isValid()) {
                values.push(result.value);
            } else {
                errors.push(result.failure);
            }
        }
        return errors.length === 0
            ? V.Valid(f(...values as P))
            : V.Invalid(objectFromEntries(errors.chain(objectToEntries)));
    });
}

/**
 * Composes a decoder that decodes an object into an instance of
 * T out of decoders which decode the constituent components. It
 * "lifts" the structure of an object into a decoder.
 *
 * ```ts
 * type Foo = { bar: string, baz: Maybe<boolean> };
 *
 * const fooDecoder: Decoder<object, Foo> = build<Foo>({
 *     bar: property("bar", string),
 *     baz: property("baz", optional(boolean))
 * });
 *
 * fooDecoder.decode({ bar: null, baz: 1 }); // Invalid ({"bar": "Required", "baz": "Expected a boolean"})
 * // Valid ({ "bar": "eek", "baz": { "tag": "Just", "value": false } })
 * fooDecoder.decode({ bar: "eek", baz: false });
 * fooDecoder.encode({ bar: "eek", baz: Just(false) }); // { bar: "eek", baz: false }
 * ```
 *
 * @param spec an object composed of [[Decoder]]s to build the result out of in an [[Decoder]].
 * @returns An [[Decoder]] which will produce a `T` with the values produced by the [[Decoder]]s in `spec`.
 */
function build<T extends object>(spec: MapDecoder<object, T>): Decoder<unknown, T> {
    return makeDecoder((input) => {
        if (input == null || typeof(input) !== "object") {
            return V.Invalid({ $: "Expected an object" });
        } else {
            const kvps: Array<[keyof T, T[keyof T]]> = [];
            const errors: DecodeError[] = [];
            for (const key in spec) {
                if (spec.hasOwnProperty(key)) {
                    const d = spec[key];
                    const result = d.decode(input as object);
                    if (result.isValid()) {
                        kvps.push([key, result.value]);
                    } else {
                        errors.push(result.failure);
                    }
                }
            }
            return errors.length === 0
                ? V.Valid(objectFromEntries(kvps))
                : V.Invalid(objectFromEntries(errors.chain(objectToEntries)));
        }
    });
}

/*------------------------------
  KLIESLI-COMPOSITION FUNCTIONS
  ------------------------------*/

/**
 * Maps a function over an array of inputs and produces a decoder for each.
 *
 * @param f produces an [[Decoder]] for each element in `as`
 * @param as an array of inputs.
 * @returns an [[Decoder]] witch produces the values produced by `f` in order.
 */
function mapM<TIn, A, B>(f: (value: A) => Decoder<TIn, B>, as: A[]): Decoder<TIn, B[]> {
    return makeDecoder((x) => V.mapM((a) => f(a).decode(x), as));
}

/**
 * [[mapM]] with its arguments reversed. Generally provides better
 * ergonomics when `f` is a lambda (squint and it looks a bit like a `for` loop).
 *
 * @param f produces an [[Decoder]] for each element in `as`
 * @param as an array of inputs.
 * @returns an [[Decoder]] witch produces the values produced by `f` in order.
 */
function forM<TIn, A, B>(as: A[], f: (value: A) => Decoder<TIn, B>): Decoder<TIn, B[]> {
    return mapM(f, as);
}

/**
 * Runs a sequence of decoders and aggregates their results.
 *
 * @param das A sequence of decoders to run.
 * @returns An [[Decoder]] which runs `das` in sequence and aggregates their results or failures.
 */
function sequence<TIn, A>(das: Array<Decoder<TIn, A>>): Decoder<TIn, A[]> {
    return mapM(preludeId, das);
}

/**
 * Maps a decomposition of parts over an array of inputs.
 *
 * @param f A decomposition function.
 * @param as An array of inputs.
 * @param n optional param to control the number of buckets in the case of empty input.
 */
function mapAndUnzipWith<TIn, N extends number, A, P extends any[] & { length: N }>(
    f: (a: A) => Decoder<TIn, P>,
    as: A[],
    n: N = 0 as any): Decoder<TIn, MapArray<P>> {

    return mapM(f, as).map((x) => unzip(x, n));
}

/**
 * Reads two input arrays in-order and produces a decoder for each pair,
 * then aggregates the results.
 *
 * @param f A function that merges two inputs into a decoder.
 * @param as The first set of inputs.
 * @param params Additional arrays to zip.
 */
function zipWithM<TIn, A, P extends any[], C>(
    f: (a: A, ...params: P) => Decoder<TIn, C>,
    as: A[],
    ...params: MapArray<P>): Decoder<TIn, C[]> {

    return sequence(as.zipWith(f, ...params as any));
}
