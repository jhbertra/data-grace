export {
    Encoder,
    IEncoder,
    MapEncoder,
    array,
    boolean,
    build,
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
 * The public methods exposed by the [[IEncoder]] type.
 */
interface IEncoder<TOut, A> {

    /**
     * Consume an instance of `A` and produce a `TOut`.
     *
     * @param a The input to consume.
     * @returns `A` encoded as `TOut`.
     */
    encode(a: A): TOut;

    /**
     * Obtain the input for this [[IEncoder]] from a different
     * type before running the [[IEncoder]].
     *
     * ```ts
     * string.contramap(n => n.ToString()).encode(12); // "12"
     * ```
     *
     * @param f a function that modifies values before they are consumed by this [[IEncoder]].
     * @returns an [[IEncoder]] that accepts values which are transformed and fed to this [[IEncoder]].
     */
    contramap<B>(f: (b: B) => A): IEncoder<TOut, B>;
}

/**
 * A type transformer that homomorphically maps the [[IEncoder]]
 * onto the types of A.
 *
 * ```ts
 * // Example = {a: IEncoder<unknown, string>, b: IEncoder<unknown, number>}
 * type Example = MapEncoder<unknown, {a: string, b: number}>
 * ```
 */
type MapEncoder<TOut, A> = { [K in keyof A]: IEncoder<TOut, A[K]> };

/*------------------------------
  CONSTRUCTORS
  ------------------------------*/

/**
 * Creates an [[IEncoder]] that runs the given encoding function.
 */
function Encoder<TOut, A>(encode: (a: A) => TOut): IEncoder<TOut, A> {
    return Object.freeze({
        contramap: (f) => Encoder((x) => encode(f(x as any))),
        encode: (x) => encode(x),
    }) as IEncoder<TOut, A>;
}

/*------------------------------
  GENERAL-PURPOSE ENCODERS
  ------------------------------*/

/**
 * Conversion from booleans to raw data.
 */
// tslint:disable-next-line: variable-name
const boolean: IEncoder<unknown, boolean> = Encoder(id);

/**
 * Conversion from numbers to raw data.
 */
// tslint:disable-next-line: variable-name
const number: IEncoder<unknown, number> = Encoder(id);

/**
 * Conversion from strings to raw data.
 */
// tslint:disable-next-line: variable-name
const string: IEncoder<unknown, string> = Encoder(id);

/**
 * Encodes an array of items into a raw form.
 */
function array<T>(convert: IEncoder<unknown, T>): IEncoder<unknown, T[]> {
    return Encoder((x) => x.map(convert.encode));
}

/**
 * Conversion from [[Maybe]] data to raw, possibly `undefined` values.
 *
 * ```ts
 * optional(string).encode(Nothing()); // undefined
 * optional(string).encode(Just(12)); // 12
 * ```
 */
function optional<T>(convert: IEncoder<unknown, T>): IEncoder<unknown, Maybe<T>> {
    return Encoder((x) => x.matchCase({ just: convert.encode, nothing: () => undefined }));
}

/**
 * Encode a value as a property on a JavaScript object.
 *
 * ```ts
 * property("foo", string).encode("bar"); // { foo: "bar" }
 * ```
 */
function property<T>(name: string, convert: IEncoder<unknown, T>): IEncoder<object, T> {
    return Encoder((value) => ({ [name]: convert.encode(value) }));
}

/**
 * Encode the elements within a tuple.
 */
function tuple<T extends any[]>(...converters: MapEncoder<unknown, T>): IEncoder<unknown, T> {
    return Encoder((t) => converters.zipWith((convert, elem) => convert.encode(elem), t));
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
 * const fooEncoder: IEncoder<object, Foo> = build<Foo>({
 *     bar: property("bar", string),
 *     baz: property("baz", optional(boolean))
 * });
 *
 * fooEncoder.encode({ bar: "eek", baz: Just(false) }); // { bar: "eek", baz: false }
 * ```
 */
function build<T extends object>(spec: MapEncoder<object, T>): IEncoder<unknown, T> {
    return Encoder((obj) => objectFromEntries(
        objectToEntries(spec)
            .map(([key, convert]) => convert.encode(obj[key]))
            .chain(objectToEntries)));
}
