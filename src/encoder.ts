import { zipWith } from "./array";
import { Maybe } from "./maybe";
import { id, objectToEntries } from "./prelude";

/*------------------------------
  DATA TYPES
  ------------------------------*/

export interface IEncoder<TOut, A> {
    readonly contramap: <B>(f: (b: B) => A) => Encoder<TOut, B>;
}

export type Encoder<TOut, A> = { encode: (a: A) => TOut } & IEncoder<TOut, A>;
export type MapEncoder<TOut, A> = { [K in keyof A]: Encoder<TOut, A[K]> };

/*------------------------------
  CONSTRUCTORS
  ------------------------------*/

export function Encoder<TOut, A>(encode: (a: A) => TOut): Encoder<TOut, A> {
    return  Object.freeze({
        contramap: (f) => Encoder((x) => encode(f( x as any))),
        encode: (x) => encode(x),
    }) as Encoder<TOut, A>;
}

/*------------------------------
  GENERAL-PURPOSE ENCODERS
  ------------------------------*/

export const date: Encoder<any, Date> = Encoder(id);
// tslint:disable-next-line: variable-name
export const boolean: Encoder<any, boolean> = Encoder(id);
// tslint:disable-next-line: variable-name
export const number: Encoder<any, number> = Encoder(id);
// tslint:disable-next-line: variable-name
export const string: Encoder<any, string> = Encoder(id);

export function array<T>(convert: Encoder<any, T>): Encoder<any, T[]> {
    return Encoder((x) => x.map(convert.encode));
}

export function optional<T>(convert: Encoder<any, T>): Encoder<any, Maybe<T>> {
    return Encoder((x) => x.matchCase({ just: convert.encode, nothing: () => undefined }));
}

export function object<T extends object>(convert: Encoder<object, T>): Encoder<object, T> {
    return convert;
}

export function property<T>(name: string, convert: Encoder<any, T>): Encoder<object, T> {
    return Encoder((value) => ({ [name]: convert.encode(value) }));
}

export function tuple<T extends any[]>(...converters: MapEncoder<any, T>): Encoder<any, T> {
    return Encoder((t) => zipWith((elem, convert) => convert.encode(elem), t, converters));
}

/*------------------------------
  GENERAL LIFTING FUNCTIONS
  ------------------------------*/

export function liftO<T>(spec: MapEncoder<object, T>): Encoder<object, T> {
    return Encoder((obj) => objectToEntries(spec)
        .map(([key, convert]) => convert.encode(obj[key]))
        .reduce((a, b) => ({...a, ...b}), {}));
}
