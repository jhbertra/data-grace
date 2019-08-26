export {
    ICodec,
    MapCodec,
    Codec,
    $case,
    array,
    boolean,
    makeCodec,
    number,
    oneOf,
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
import { Case, objectFromEntries, objectToEntries } from "./prelude";
import { Validation } from "./validation";

/*------------------------------
  DATA TYPES
  ------------------------------*/

/**
 * The public methods exposed by the [[Codec]] type.
 */
interface ICodec<TRaw, A> {

    /**
     * Map invariantly over the rich data format of the codec.
     * The bidirectional mapping requires that any transformation must
     * be "undoable" (i.e. `A` and `B` are isomorphic).
     */
    invmapRich<B>(f: (a: A) => B, g: (b: B) => A): Codec<TRaw, B>;

    /**
     * Map invariantly over the raw data format of the codec.
     * The bidirectional mapping requires that any transformation must
     * be "undoable" (i.e. `TRaw` and `TRaw2` are isomorphic).
     */
    invmapRaw<TRaw2>(f: (a: TRaw) => TRaw2, g: (b: TRaw2) => TRaw): Codec<TRaw2, A>;

    /**
     * Map invariantly over the both the raw and the rich data formats of the codec.
     * The bidirectional mapping requires that any transformation must
     * be "undoable" (i.e. `TRaw` and `TRaw2` are isomorphic, as must `A` and `B`).
     */
    invmapBoth<TRaw2, B>(
        f: (a: TRaw) => TRaw2,
        g: (b: TRaw2) => TRaw,
        h: (a: A) => B,
        i: (b: B) => A): Codec<TRaw2, B>;

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
 * is comprised of an [[Decoder]] and an [[Encoder]], which
 * convert data between a rich data format and a raw data format.
 *
 * An additional requirement of codecs is that their components must
 * perform invariant conversion - that is to say that if the output of
 * the decoder is run through the encoder or vice versa, the end result
 * should be structurally equivalent to the initial input, which is to say:
 *
 * ```ts
 * codec.decode(codec.encode(decodedData)) === decodedData // structural, not referential equality
 * codec.encode(codec.decode(rawData)) === rawData
 * ```
 */
type Codec<TRaw, A> = { decoder: Decoder<TRaw, A>, encoder: Encoder<TRaw, A> } & ICodec<TRaw, A>;

/**
 * A type transformer that homomorphically maps the [[Codec]]
 * onto the types of A.
 *
 * ```ts
 * // Example = {a: Codec<unknown, string>, b: Codec<unknown, number>}
 * type Example = MapCodec<unknown, {a: string, b: number}>
 * ```
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
        invmapBoth: (f, g, h, i) => makeCodec(decoder.dimap(g, h), encoder.dimap(i, f)),
        invmapRaw: (f, g) => makeCodec(decoder.contramap(g), encoder.map(f)),
        invmapRich: (f, g) => makeCodec(decoder.map(f), encoder.contramap(g)),
    }) as Codec<TRaw, A>;
}

/*------------------------------
  GENERAL-PURPOSE CODECS
  ------------------------------*/

/**
 * Conversion between unknown data and booleans.
 *
 * ```ts
 * boolean.decode(true); // Valid (true)
 * boolean.decode("true"); // Invalid ({"$": "Expected a boolean"})
 *
 * boolean.encode(false); // false
 * ```
 */
// tslint:disable-next-line: variable-name
const boolean: Codec<unknown, boolean> = makeCodec(D.boolean, E.boolean);

/**
 * Conversion between unknown data and numbers.
 *
 * ```ts
 * number.decode(1); // Valid (1)
 * number.decode("1"); // Invalid ({"$": "Expected a number"})
 *
 * number.encode(2); // 2
 * ```
 */
// tslint:disable-next-line: variable-name
const number: Codec<unknown, number> = makeCodec(D.number, E.number);

/**
 * Conversion between unknown data and strings.
 *
 * ```ts
 * string.decode(null); // Invalid ({"$": "Expected a string"})
 * string.decode("foo"); // Valid ("foo")
 *
 * string.encode("bar"); // "bar"
 * ```
 */
// tslint:disable-next-line: variable-name
const string: Codec<unknown, string> = makeCodec(D.string, E.string);

/**
 * Conversion between unknown data and arrays.
 *
 * ```ts
 * array(string).decode("foo"); // Invalid ({"$": "Expected an array"})
 * array(string).decode([true, "foo"]); // Invalid ({"[0]": "Expected a string"})
 * array(string).decode(["foo"]); // Valid (["foo"])
 *
 * array(string).encode(["bar"]); // ["bar"]
 * ```
 */
function array<T>(itemCodec: Codec<unknown, T>): Codec<unknown, T[]> {
    return makeCodec(D.array(itemCodec.decoder), E.array(itemCodec.encoder));
}

/**
 * Conversion within the context of a union case.
 */
function $case<Tag extends string, TCase, T extends Case<Tag> & TCase>(
    tag: Tag,
    innerCodec: Codec<object, TCase>,
): [(_: T) => boolean, Codec<object, T>] {
    const [p, encoder] = E.$case(tag, innerCodec.encoder);
    return [
        p,
        makeCodec(D.$case(tag, innerCodec.decoder), encoder) as any,
    ];
}

/**
 * Runs the first encoder that satisfies its paired predicate. Else
 * throws an exception.
 */
function oneOf<T>(...choices: Array<[(t: T) => boolean, Codec<unknown, T>]>): Codec<unknown, T> {
    return makeCodec(
        D.oneOf(...choices.map(([_, c]) => c.decoder)),
        E.oneOf(...choices.map(([p, c]) => [p, c.encoder] as [(t: T) => boolean, Encoder<unknown, T>])));
}

/**
 * Conversion between unknown data and optional types.
 *
 * ```ts
 * optional(string).decode(null); // Valid (Nothing)
 * optional(string).decode(unknown); // Valid (Nothing)
 * optional(string).decode("foo"); // Valid (Just (foo))
 * optional(string).decode(true); // Invalid ({"$": "Expected a string"})
 *
 * optional(string).encode(Nothing()); // undefined
 * optional(string).encode(Just("foo")); // "foo"
 * ```
 */
function optional<T>(innerCodec: Codec<unknown, T>): Codec<unknown, Maybe<T>> {
    return makeCodec(D.optional(innerCodec.decoder), E.optional(innerCodec.encoder));
}

/**
 * Reads and writes properties of an object.
 *
 * ```ts
 * property("bar": string).decode({}); // Invalid ({"bar", "Required"})
 * property("bar": string).decode({ bar: true}); // Invalid ({"bar", "Expected a string"})
 * property("bar": string).decode({ bar: "foo"}); // Valid ("foo")
 *
 * property("bar": string).encode("foo"); // Valid ({ bar: "foo" })
 * ```
 */
function property<T>(name: string, convert: Codec<unknown, T>): Codec<object, T> {
    return makeCodec(D.property(name, convert.decoder), E.property(name, convert.encoder));
}

/**
 * Conversion between unknown data and tuples.
 *
 * ```ts
 * tuple(string, number).decode("foo"); // Invalid ({"$": "Expected an array"})
 * tuple(string, number).decode([1, "foo"]); // Invalid ({"[0]": "Expected a string", "[1]": "Expected a number"})
 * tuple(string, number).decode(["foo", 1]); // Valid (["foo", 1])
 *
 * tuple(string, number).encode(["foo", 1]); // ["foo", 1]
 * ```
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
 * ```ts
 * type Foo = { bar: string, baz: Maybe<boolean> };
 *
 * const fooCodec: Codec<object, Foo> = build<Foo>({
 *     bar: property("bar", string),
 *     baz: property("baz", optional(boolean))
 * });
 *
 * fooCodec.decode({ bar: null, baz: 1 }); // Invalid ({"bar": "Required", "baz": "Expected a boolean"})
 * // Valid ({ "bar": "eek", "baz": { "tag": "Just", "value": false } })
 * fooCodec.decode({ bar: "eek", baz: false });
 * fooCodec.encode({ bar: "eek", baz: Just(false) }); // { bar: "eek", baz: false }
 * ```
 */
export function build<T extends object>(spec: MapCodec<object, T>): Codec<unknown, T> {
    return makeCodec(
        D.build(objectFromEntries(objectToEntries(spec).map(([key, value]) => [key, value.decoder]) as any)),
        E.build(objectFromEntries(objectToEntries(spec).map(([key, value]) => [key, value.encoder]) as any)));
}
