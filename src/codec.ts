export {
    ICodec,
    MapCodec,
    Codec,
    array,
    boolean,
    date,
    makeCodec,
    number,
    optional,
    property,
    string,
    tuple,
};

import { Decoder } from "./decoder";
import * as D from "./decoder";
import { Encoder } from "./encoder";
import * as E from "./encoder";
import { Maybe } from "./maybe";
import { id, objectFromEntries, objectToEntries } from "./prelude";
import { Validation } from "./validation";

/*------------------------------
  DATA TYPES
  ------------------------------*/

/**
 * The public methods exposed by the {@link Codec} type.
 */
interface ICodec<TRaw, A> {

    /**
     * Map invariantly over the rich data format of the codec.
     * The bidirectional mapping requires that any transformation must
     * be "undoable".
     */
    invmap<B>(f: (a: A) => B, g: (b: B) => A): Codec<TRaw, B>;

    /**
     * Decode raw data into a rich format.
     */
    decode(raw: TRaw): Validation<D.DecodeError, A>;

    /**
     * Encode rich data as raw data.
     */
    encode(a: A): TRaw;
}

/**
 * A codec is a pair of bidirectional conversion functions. It
 * is comprised of a {@link Decoder} and an {@link Encoder}, which
 * convert data between a rich data format and a raw data format.
 *
 * An additional requirement of codecs is that their components must
 * perform invariant conversion - that is to say that if the output of
 * the decoder is run through the encoder or vice versa, the end result
 * should be structurally equivalent to the initial input, which is to say:
 *
 * @example
 *
 *      codec.decode(codec.encode(decodedData)) === decodedData // structural, not referential equality
 *      codec.encode(codec.decode(rawData)) === rawData
 */
type Codec<TRaw, A> = { decoder: Decoder<TRaw, A>, encoder: Encoder<TRaw, A> } & ICodec<TRaw, A>;

/**
 * A type transformer that homomorphically maps the {@link Codec}
 * onto the types of A.
 *
 * @example
 *
 *      // Map the fields of an object
 *      type Foo = { bar: number, baz: string };
 *
 *      // Write a type test
 *      type PropEquality =
 *          MapCodec<string, Foo> extends { bar: Codec<string, number>, baz: Codec<string, string> }
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
 *          MapCodec<string, Foo> extends Codec<string, string>[]
 *              ? any
 *              : never;
 *
 *      // Witness the proof of the proposition (compiles)
 *      const proof : PropEquality = "witness"
 */
type MapCodec<TRaw, A> = { [K in keyof A]: Codec<TRaw, A[K]> };

/*------------------------------
  CONSTRUCTORS
  ------------------------------*/

/**
 * Creates a new codec that uses the give decoder / encoder pair.
 */
function makeCodec<TRaw, A>(decoder: Decoder<TRaw, A>, encoder: Encoder<TRaw, A>): Codec<TRaw, A> {
    return Object.freeze({
        decode: decoder.decode,
        decoder,
        encode: encoder.encode,
        encoder,
        invmap: (f, g) => makeCodec(decoder.map(f), encoder.contramap(g)),
    }) as Codec<TRaw, A>;
}

/*------------------------------
  GENERAL-PURPOSE CODECS
  ------------------------------*/

/**
 * Conversion between unknown data and dates.
 *
 * @example
 *
 *      date.decode(true); // Invalid ({"$": "Expected a date"})
 *      date.decode("2019-07-26"); // Valid (Fri Jul 26 2019 00:00:00 GMT-0000 (UTC))
 *      date.decode(Date.parse("2019-07-26")); // Valid (Fri Jul 26 2019 00:00:00 GMT-0000 (UTC))
 *
 *      date.encode(Date.parse("2019-07-26")); // Fri Jul 26 2019 00:00:00 GMT-0000 (UTC)
 */
const date: Codec<unknown, Date> = makeCodec(D.date, E.date);

/**
 * Conversion between unknown data and booleans.
 *
 * @example
 *
 *      boolean.decode(true); // Valid (true)
 *      boolean.decode("true"); // Invalid ({"$": "Expected a boolean"})
 *
 *      boolean.encode(false); // false
 */
// tslint:disable-next-line: variable-name
const boolean: Codec<unknown, boolean> = makeCodec(D.boolean, E.boolean);

/**
 * Conversion between unknown data and numbers.
 *
 * @example
 *
 *      number.decode(1); // Valid (1)
 *      number.decode("1"); // Invalid ({"$": "Expected a number"})
 *
 *      number.encode(2); // 2
 */
// tslint:disable-next-line: variable-name
const number: Codec<unknown, number> = makeCodec(D.number, E.number);

/**
 * Conversion between unknown data and strings.
 *
 * @example
 *
 *      string.decode(null); // Invalid ({"$": "Expected a string"})
 *      string.decode("foo"); // Valid ("foo")
 *
 *      string.encode("bar"); // "bar"
 */
// tslint:disable-next-line: variable-name
const string: Codec<unknown, string> = makeCodec(D.string, E.string);

/**
 * Conversion between unknown data and arrays.
 *
 * @example
 *
 *      array(string).decode("foo"); // Invalid ({"$": "Expected an array"})
 *      array(string).decode([true, "foo"]); // Invalid ({"[0]": "Expected a string"})
 *      array(string).decode(["foo"]); // Valid (["foo"])
 *
 *      array(string).encode(["bar"]); // ["bar"]
 */
function array<T>(itemCodec: Codec<unknown, T>): Codec<unknown, T[]> {
    return makeCodec(D.array(itemCodec.decoder), E.array(itemCodec.encoder));
}

/**
 * Conversion between unknown data and optional types.
 *
 * @example
 *
 *      optional(string).decode(null); // Valid (Nothing)
 *      optional(string).decode(unknown); // Valid (Nothing)
 *      optional(string).decode("foo"); // Valid (Just (foo))
 *      optional(string).decode(true); // Invalid ({"$": "Expected a string"})
 *
 *      optional(string).encode(Nothing()); // undefined
 *      optional(string).encode(Just("foo")); // "foo"
 */
function optional<T>(innerCodec: Codec<unknown, T>): Codec<unknown, Maybe<T>> {
    return makeCodec(D.optional(innerCodec.decoder), E.optional(innerCodec.encoder));
}

/**
 * Reads and writes properties of an object.
 *
 * @example
 *
 *      property("bar": string).decode({}); // Invalid ({"bar", "Required"})
 *      property("bar": string).decode({ bar: true}); // Invalid ({"bar", "Expected a string"})
 *      property("bar": string).decode({ bar: "foo"}); // Valid ("foo")
 *
 *      property("bar": string).encode("foo"); // Valid ({ bar: "foo" })
 */
function property<T>(name: string, convert: Codec<unknown, T>): Codec<object, T> {
    return makeCodec(D.property(name, convert.decoder), E.property(name, convert.encoder));
}

/**
 * Conversion between unknown data and tuples.
 *
 * @example
 *
 *      tuple(string, number).decode("foo"); // Invalid ({"$": "Expected an array"})
 *      tuple(string, number).decode([1, "foo"]); // Invalid ({"[0]": "Expected a string", "[1]": "Expected a number"})
 *      tuple(string, number).decode(["foo", 1]); // Valid (["foo", 1])
 *
 *      tuple(string, number).encode(["foo", 1]); // ["foo", 1]
 */
function tuple<T extends any[]>(...converters: MapCodec<any, T>): Codec<any, T> {
    return makeCodec(D.tuple(...converters.map((x) => x.decoder)), E.tuple(...converters.map((x) => x.encoder))) as any;
}

/*------------------------------
  GENERAL LIFTING FUNCTIONS
  ------------------------------*/

/**
 * Composes a codec that transforms between TRaw and T out of
 * codecs which transforms the constituent components. It
 * "lifts" the structure of an object into a codec.
 *
 * @example
 *
 *      type Foo = { bar: string, baz: Maybe<boolean> };
 *
 *      const fooCodec: Codec<object, Foo> = build<Foo>({
 *          bar: property("bar", string),
 *          baz: property("baz", optional(boolean))
 *      });
 *
 *      fooCodec.decode({ bar: null, baz: 1 }); // Invalid ({"bar": "Required", "baz": "Expected a boolean"})
 *      // Valid ({ "bar": "eek", "baz": { "tag": "Just", "value": false } })
 *      fooCodec.decode({ bar: "eek", baz: false });
 *      fooCodec.encode({ bar: "eek", baz: Just(false) }); // { bar: "eek", baz: false }
 */
export function build<T extends object>(spec: MapCodec<object, T>): Codec<unknown, T> {
    return makeCodec(
        D.build(objectFromEntries(objectToEntries(spec).map(([key, value]) => [key, value.decoder]) as any)),
        E.build(objectFromEntries(objectToEntries(spec).map(([key, value]) => [key, value.encoder]) as any)));
}
