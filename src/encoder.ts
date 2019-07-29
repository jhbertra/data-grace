export {
    IEncoder,
    Encoder,
    MapEncoder,
    array,
    boolean,
    date,
    liftO,
    makeEncoder,
    number,
    object,
    optional,
    property,
    string,
    tuple,
};

import { zipWith } from "./array";
import { Maybe } from "./maybe";
import { id, objectToEntries } from "./prelude";

/*------------------------------
  DATA TYPES
  ------------------------------*/

/**
 * The public methods exposed by the @see Encoder type.
 */
interface IEncoder<TOut, A> {

    /**
     * Obtain the input for this @see Encoder from a different
     * type before running the @see Encoder
     */
    contramap<B>(f: (b: B) => A): Encoder<TOut, B>;
}

/**
 * An encoder is a function that takes some well-typed data
 * and converts it into a raw form.
 */
type Encoder<TOut, A> = { encode: (a: A) => TOut } & IEncoder<TOut, A>;

/**
 * A type transformer that homomorphically maps the @see Encoder
 * onto the types of A.
 *
 * @example
 *
 *      // Map the fields of an object
 *      type Foo = { bar: number, baz: string };
 *
 *      // Write a type test
 *      type PropEquality =
 *          MapEncoder<string, Foo> extends { bar: Encoder<string, number>, baz: Encoder<string, string> }
 *              ? any
 *              : never;
 *      // witness the proof of the proposition (compiles)
 *      const proof : PropEquality = "witness"
 *
 * @example
 *
 *      // Map the items of an array
 *      type Foo = string[];
 *
 *      // Write a type test
 *      type PropEquality = MapEncoder<string, Foo> extends Encoder<string, string>[] ? any : never;
 *      // Witness the proof of the proposition (compiles)
 *      const proof : PropEquality = "witness"
 */
type MapEncoder<TOut, A> = { [K in keyof A]: Encoder<TOut, A[K]> };

/*------------------------------
  CONSTRUCTORS
  ------------------------------*/

/**
 * Creates an @see Encoder that runs the given encoding function.
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
 * Conversion from dates to raw data.
 */
const date: Encoder<any, Date> = makeEncoder(id);

/**
 * Conversion from booleans to raw data.
 */
// tslint:disable-next-line: variable-name
const boolean: Encoder<any, boolean> = makeEncoder(id);

/**
 * Conversion from numbers to raw data.
 */
// tslint:disable-next-line: variable-name
const number: Encoder<any, number> = makeEncoder(id);

/**
 * Conversion from strings to raw data.
 */
// tslint:disable-next-line: variable-name
const string: Encoder<any, string> = makeEncoder(id);

/**
 * Encodes an array of items into a raw form.
 */
function array<T>(convert: Encoder<any, T>): Encoder<any, T[]> {
    return makeEncoder((x) => x.map(convert.encode));
}

/**
 * Conversion from @see Maybe data to raw, possibly @see undefined values.
 */
function optional<T>(convert: Encoder<any, T>): Encoder<any, Maybe<T>> {
    return makeEncoder((x) => x.matchCase({ just: convert.encode, nothing: () => undefined }));
}

/**
 * Encode an object with the given converter.
 */
function object<T extends object>(convert: Encoder<object, T>): Encoder<object, T> {
    return convert;
}

/**
 * Encode a value as a propertry on a JavaScript object.
 */
function property<T>(name: string, convert: Encoder<any, T>): Encoder<object, T> {
    return makeEncoder((value) => ({ [name]: convert.encode(value) }));
}

/**
 * Encode the elements within a tuple.
 */
function tuple<T extends any[]>(...converters: MapEncoder<any, T>): Encoder<any, T> {
    return makeEncoder((t) => zipWith((elem, convert) => convert.encode(elem), t, converters));
}

/*------------------------------
  GENERAL LIFTING FUNCTIONS
  ------------------------------*/

/**
 * Composes an encoder that converts an instance of T to TRaw out of
 * encoders which encode the constituent components. It
 * "lifts" the structure of an object into a encoder.
 *
 * @example
 *
 *      type Foo = { bar: string, baz: Maybe<boolean> };
 *
 *      const fooEncoder: Encoder<object, Foo> = liftO<Foo>({
 *          bar: property("bar", string),
 *          baz: property("baz", optional(boolean))
 *      });
 *
 *      fooEncoder.encode({ bar: "eek", baz: Just(false) }); // { bar: "eek", baz: false }
 */
function liftO<T>(spec: MapEncoder<object, T>): Encoder<object, T> {
    return makeEncoder((obj) => objectToEntries(spec)
        .map(([key, convert]) => convert.encode(obj[key]))
        .reduce((a, b) => ({ ...a, ...b }), {}));
}