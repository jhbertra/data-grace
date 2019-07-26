import {unzip, zipWith} from "./array";
import {id, objectToEntries, objectFromEntries, constant} from "./prelude";
import { Maybe, Nothing, Just } from "./maybe";
import { Validation } from "./validation";
import * as V from "./validation";
import { Either } from "./either";

/*
 * Data Types
 */
export interface IDecoder<TIn, A> {
    readonly map: <B>(f: (c: A) => B) => Decoder<TIn, B>,
    readonly or: (other: () => Decoder<TIn, A>) => Decoder<TIn, A>,
    readonly replace: <B>(m: Decoder<TIn, B>) => Decoder<TIn, B>,
    readonly replacePure: <B>(c: B) => Decoder<TIn, B>,
    readonly voidOut: () => Decoder<TIn, []>
}


export type DecodeError = [string, string];
export type Decoder<TIn, A> = {
    decode: (input: TIn) => Validation<DecodeError, A>
} & IDecoder<TIn, A>;
export type MapDecoder<TIn, A> = { [K in keyof A]: Decoder<TIn, A[K]> };



/*
 * Constructors
 */

export function Decoder<TIn, A>(decode: (input: TIn) => Validation<DecodeError, A>) : Decoder<TIn, A> {
    return <Decoder<TIn, A>>Object.freeze({
        decode: decode,
        map: f => Decoder(x => decode(x).map(f)),
        or: d => Decoder(x => decode(x).or(() => d().decode(x))),
        replace: d => Decoder(x => decode(x).replace(d.decode(x))),
        replacePure: f => Decoder(x => decode(x).replacePure(f)),
        voidOut: () => Decoder<TIn, []>(x => decode(x).voidOut())
    });
}



/*
 * General lifting functions.
 */

export function liftF<TIn, P extends any[], R>(f: (...args: P) => R, ...args: MapDecoder<TIn, P>): Decoder<TIn, R> {
    return sequence(args).map(a => f.apply(undefined, <P>a));
}

export function liftO<TIn, T>(spec: MapDecoder<TIn, T>): Decoder<TIn, T> {
    const maybeKvps = sequence(objectToEntries(spec).map(
        ([key, value]) => value.map(x => <[keyof T, T[typeof key]]>[key, x])));

    return maybeKvps.map(objectFromEntries);
}



/*
 * Kliesli composition functions
 */

export function mapM<TIn, A, B>(f: (value: A) => Decoder<TIn, B>, as: A[]): Decoder<TIn, B[]> {
    return Decoder(x => V.sequence(as.map(f).map(d => d.decode(x))));
}

export function forM<TIn, A, B>(as: A[], f: (value: A) => Decoder<TIn, B>): Decoder<TIn, B[]> {
    return mapM(f, as);
}

export function sequence<TIn, A>(bs: Decoder<TIn, A>[]): Decoder<TIn, A[]> {
    return mapM(id, bs);
}

export function mapAndUnzipWith<TIn, A, B, C>(f: (a: A) => Decoder<TIn, [B, C]>, as: A[]): Decoder<TIn, [B[], C[]]> {
    return mapM(f, as).map(unzip);
}

export function zipWithM<TIn, A, B, C>(f: (a: A, b: B) => Decoder<TIn, C>, as: A[], bs: B[]): Decoder<TIn, C[]> {
    return sequence(zipWith(f, as, bs));
}



/*
 * Decoders
 */

function prefixError(prefix: string, [childError, message]: DecodeError): DecodeError {
    const suffix = childError === "$"
        ? ""
        : childError.startsWith("[")
            ? childError
            : `.${childError}`;

    return [`${prefix}${suffix}`, message]
}

export const date: Decoder<any, Date> = Decoder((value: any) => {
    if (value instanceof Date) {
        return V.Valid(value);
    } else {
        const parsed = Date.parse(value);
        return parsed === NaN
            ? V.Invalid([["$", "Expected a date"]])
            : V.Valid(new Date(parsed));
    }
});

export const boolean: Decoder<any, boolean> = Decoder(
    (value: any) => typeof(value) === "boolean" ? V.Valid(value) : V.Invalid([["$", "Expected a boolean"]]));

export const number: Decoder<any, number> = Decoder(
    (value: any) => typeof(value) === "number" ? V.Valid(value) : V.Invalid([["$", "Expected a number"]]));

export const string: Decoder<any, string> = Decoder(
    (value: any) => typeof(value) === "string" ? V.Valid(value) : V.Invalid([["$", "Expected a string"]]));

export function array<T>(convert: Decoder<any, T>): Decoder<any, T[]> {
    return Decoder(value => Array.isArray(value)
        ? V.sequence(value.map((x, i) => convert.decode(x).mapErrors(error => prefixError(`[${i}]`, error))))
        : V.Invalid([["$", "Expected an array"]]));
}

export function oneOf<T>(...choices: T[]): Decoder<any, T> {
    return Decoder(value => {
        const found = choices.find(x => x === value);
        return found
            ? V.Valid(found)
            : V.Invalid(choices.length === 0
                ? [["$", "There are no valid options to choose from"]]
                : [["$", `Valid options: ${choices.join(" | ")}`]]);
    });
}

export function optional<T>(convert: Decoder<any, T>): Decoder<any, Maybe<T>> {
    return Decoder(
        value => value === null || value === undefined ? V.Valid(Nothing()) : convert.decode(value).map(Just));
}

export function object<T extends object>(convert: Decoder<object, T>): Decoder<object, T> {
    return Decoder(
        value => typeof(value) === "object" && value !== null ? convert.decode(value) : V.Invalid([["$", "Expected an object"]]));
}

export function property<T>(
    name: string,
    convert: Decoder<any, T>): Decoder<object, T> {
        return Decoder(obj => obj.hasOwnProperty(name)
            ? convert.decode((<any>obj)[name]).mapErrors(error => prefixError(name, error))
            : V.Invalid([[name, "Required"]]));
}

export function tuple<T extends any[]>(...converters: { [K in keyof T]: Decoder<any, T[K]> }): Decoder<any, T> {
    return Decoder(value => Array.isArray(value)
        ? value.length === converters.length
            ? <Validation<DecodeError, T>><unknown>V.zipWithM(
                (x, [converter, i]) => converter.decode(x).mapErrors(error => prefixError(`[${i}]`, error)),
                value,
                converters.map((x, i) => <[Decoder<any, T[keyof T]>, number]>[x, i]))
            : V.Invalid([["$", `Expected an array of length ${converters.length}`]])
        : V.Invalid([["$", `Expected an array of length ${converters.length}`]]));
}