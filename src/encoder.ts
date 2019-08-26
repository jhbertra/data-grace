export {
    Encoder,
    MapEncoder,
    array,
    boolean,
    build,
    makeEncoder,
    number,
    optional,
    property,
    string,
    tuple,
};

import { Maybe } from "./maybe";
import { id, objectFromEntries, objectToEntries } from "./prelude";

/*------------------------------
  DATA TYPES
  ------------------------------*/

/**
 * The public methods exposed by the [[Encoder]] type.
 */
interface Encoder<TOut, A> {

    /**
     * Consume an instance of `A` and produce a `TOut`.
     *
     * @param a The input to consume.
     * @returns `A` encoded as `TOut`.
     */
    encode(a: A): TOut;

    /**
     * Obtain the input for this [[Encoder]] from a different
     * type before running the [[Encoder]].
     *
     * ```ts
     * string.contramap(n => n.ToString()).encode(12); // "12"
     * ```
     *
     * @param f a function that modifies values before they are consumed by this [[Encoder]].
     * @returns an [[Encoder]] that accepts values which are transformed and fed to this [[Encoder]].
     */
    contramap<B>(f: (b: B) => A): Encoder<TOut, B>;
}

/**
 * A type transformer that homomorphically maps the [[Encoder]]
 * onto the types of A.
 *
 * ```ts
 * // Example = {a: Encoder<unknown, string>, b: Encoder<unknown, number>}
 * type Example = MapEncoder<unknown, {a: string, b: number}>
 * ```
 */
type MapEncoder<TOut, A> = { [K in keyof A]: Encoder<TOut, A[K]> };

/*------------------------------
  CONSTRUCTORS
  ------------------------------*/

/**
 * Creates an [[Encoder]] that runs the given encoding function.
 */
function makeEncoder<TOut, A>(encode: (a: A) => TOut): Encoder<TOut, A> {
    return Object.freeze({
        contramap: (f) => makeEncoder((x) => encode(f(x as any))),
        encode: (x) => encode(x),
    }) as Encoder<TOut, A>;
}

/*------------------------------
  GENERAL-PURPOSE ENCODERS
  ------------------------------*/

/**
 * Conversion from booleans to raw data.
 */
// tslint:disable-next-line: variable-name
const boolean: Encoder<unknown, boolean> = makeEncoder(id);

/**
 * Conversion from numbers to raw data.
 */
// tslint:disable-next-line: variable-name
const number: Encoder<unknown, number> = makeEncoder(id);

/**
 * Conversion from strings to raw data.
 */
// tslint:disable-next-line: variable-name
const string: Encoder<unknown, string> = makeEncoder(id);

/**
 * Encodes an array of items into a raw form.
 */
function array<T>(convert: Encoder<unknown, T>): Encoder<unknown, T[]> {
    return makeEncoder((x) => x.map(convert.encode));
}

/**
 * Conversion from [[Maybe]] data to raw, possibly `undefined` values.
 *
 * ```ts
 * optional(string).encode(Nothing()); // undefined
 * optional(string).encode(Just(12)); // 12
 * ```
 */
function optional<T>(convert: Encoder<unknown, T>): Encoder<unknown, Maybe<T>> {
    return makeEncoder((x) => x.matchCase({ just: convert.encode, nothing: () => undefined }));
}

/**
 * Encode a value as a property on a JavaScript object.
 *
 * ```ts
 * property("foo", string).encode("bar"); // { foo: "bar" }
 * ```
 */
function property<T>(name: string, convert: Encoder<unknown, T>): Encoder<object, T> {
    return makeEncoder((value) => ({ [name]: convert.encode(value) }));
}

/**
 * Encode the elements within a tuple.
 */
function tuple<T extends any[]>(...converters: MapEncoder<unknown, T>): Encoder<unknown, T> {
    return makeEncoder((t) => converters.zipWith((convert, elem) => convert.encode(elem), t));
}

/*------------------------------
  GENERAL LIFTING FUNCTIONS
  ------------------------------*/

/**
 * Composes an encoder that converts an instance of T to TRaw out of
 * encoders which encode the constituent components. It
 * "lifts" the structure of an object into a encoder.
 *
 * ```ts
 * type Foo = { bar: string, baz: Maybe<boolean> };
 *
 * const fooEncoder: Encoder<object, Foo> = build<Foo>({
 *     bar: property("bar", string),
 *     baz: property("baz", optional(boolean))
 * });
 *
 * fooEncoder.encode({ bar: "eek", baz: Just(false) }); // { bar: "eek", baz: false }
 * ```
 */
function build<T extends object>(spec: MapEncoder<object, T>): Encoder<unknown, T> {
    return makeEncoder((obj) => objectFromEntries(
        objectToEntries(spec)
            .map(([key, convert]) => convert.encode(obj[key]))
            .chain(objectToEntries)));
}
