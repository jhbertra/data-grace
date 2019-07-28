import { id, objectToEntries, objectFromEntries } from "./prelude";
import { Maybe } from "./maybe";
import { Decoder } from "./decoder";
import { Encoder } from "./encoder";
import * as D from "./decoder";
import * as E from "./encoder";
import { Validation } from "./validation";

/*------------------------------
  DATA TYPES
  ------------------------------*/

 /**
  * The public methods exposed by the {@link Codec} type.
  */
export interface ICodec<TRaw, A> {
    readonly invmap: <B>(f: (a: A) => B, g: (b: B) => A) => Codec<TRaw, B>,
    readonly decode: (raw: TRaw) => Validation<D.DecodeError, A>,
    readonly encode: (a: A) => TRaw
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
export type Codec<TRaw, A> = { decoder: Decoder<TRaw, A>, encoder: Encoder<TRaw, A> } & ICodec<TRaw, A>;


/**
 * A type transformer that homomorphically maps the {@link Codec}
 * onto the types of A.
 * 
 * @example
 * 
 *      // Map the fields of an object
 *      type Foo = { bar: number, baz: string };
 *      type FooCodecs = MapCodec<string, Foo>;
 * 
 *      // Write a type test
 *      type PropEquality = FooCodecs extends { bar: Codec<string, number>, baz: Codec<string, string> } ? any : never;
 *      // witness the proof of the proposition (compiles)
 *      const proof : PropEquality = "witness"
 * 
 * @example
 * 
 *      // Map the items of an array
 *      type Foo = string[];
 *      type FooCodecs = MapCodec<string, Foo>;
 * 
 *      // Write a type test
 *      type PropEquality = FooCodecs extends Codec<string, string>[] ? any : never;
 *      // Witness the proof of the proposition (compiles)
 *      const proof : PropEquality = "witness"
 */
export type MapCodec<TRaw, A> = { [K in keyof A]: Codec<TRaw, A[K]> };



/*------------------------------
  CONSTRUCTORS
  ------------------------------*/

/**
 * Creates a new codec that uses the give decoder / encoder pair.
 */
export function Codec<TRaw, A>(decoder: Decoder<TRaw, A>, encoder: Encoder<TRaw, A>): Codec<TRaw, A> {
    return <Codec<TRaw, A>>Object.freeze({
        decoder: decoder,
        encoder: encoder,
        decode: decoder.decode,
        encode: encoder.encode,
        invmap: (f, g) => Codec(decoder.map(f), encoder.contramap(g)),
    });
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
export const date: Codec<unknown, Date> = Codec(D.date, E.date);


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
export const boolean: Codec<unknown, boolean> = Codec(D.boolean, E.boolean);


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
export const number: Codec<unknown, number> = Codec(D.number, E.number);


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
export const string: Codec<unknown, string> = Codec(D.string, E.string);


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
export function array<T>(itemCodec: Codec<unknown, T>): Codec<unknown, T[]> {
    return Codec(D.array(itemCodec.decoder), E.array(itemCodec.encoder));
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
export function optional<T>(innerCodec: Codec<unknown, T>): Codec<unknown, Maybe<T>> {
    return Codec(D.optional(innerCodec.decoder), E.optional(innerCodec.encoder));
}


/**
 * Conversion between unknown data and a finite set of values.
 * 
 * @example
 * 
 *      oneOf("foo", "bar").decode("foo"); // Valid ("foo")
 *      oneOf("foo", "bar").decode("bar"); // Valid ("bar")
 *      oneOf("foo", "bar").decode("baz"); // Invalid ({"$": "Valid options: foo | bar"})
 * 
 *      oneOf("foo", "bar").encode("bar"); // "bar"
 */
export function oneOf<T>(...choices: T[]): Codec<unknown, T> {
    return Codec(D.oneOf(...choices), Encoder(id));
}


/**
 * Conversion between general objects and specific object types.
 * 
 * @example
 * 
 *      type Foo = { bar: string };
 *      
 *      const fooCodec = liftO<Foo>({
 *          bar: property("bar": string)
 *      });
 *        
 *      object(fooCodec).decode({ bar: "foo" }); // Valid ({ bar: "foo" })
 *      object(fooCodec).decode({ bar: true }); // Invalid ({"bar", "Expected a string"})
 *      object(fooCodec).decode({ qux: "foo" }); // Invalid ({"bar", "Required"]]
 *      object(fooCodec).decode("foo"); // Invalid ({"$": "Expected an object"})
 * 
 *      oneOf("foo", "bar").encode("bar"); // "bar"
 */
export function object<T extends object>(convert: Codec<object, T>): Codec<object, T> {
    return Codec(D.object(convert.decoder), E.object(convert.encoder));
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
export function property<T>(name: string, convert: Codec<unknown, T>): Codec<object, T> {
    return Codec(D.property(name, convert.decoder), E.property(name, convert.encoder));
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
export function tuple<T extends any[]>(...converters: MapCodec<any, T>): Codec<any, T> {
    return <any>Codec(D.tuple(...converters.map(x => x.decoder)), E.tuple(...converters.map(x => x.encoder)));
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
 *      const fooCodec: Codec<object, Foo> = liftO<Foo>({
 *          bar: property("bar", string),
 *          baz: property("baz", optional(boolean))
 *      });
 * 
 *      fooCodec.decode({ bar: null, baz: 1 }); // Invalid ({"bar": "Required", "baz": "Expected a boolean"})
 *      fooCodec.decode({ bar: "eek", baz: false }); // Valid ({ "bar": "eek", "baz": { "tag": "Just", "value": false } })
 *      fooCodec.encode({ bar: "eek", baz: Just(false) }); // { bar: "eek", baz: false }
 */
export function liftO<T>(spec: MapCodec<object, T>): Codec<object, T> {
    return Codec(
        D.liftO(objectFromEntries(<any>objectToEntries(spec).map(([key, value]) => [key, value.decoder]))),
        E.liftO(objectFromEntries(<any>objectToEntries(spec).map(([key, value]) => [key, value.encoder]))));
}