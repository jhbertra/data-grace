import { Either, Left, lefts, Right, rights } from "./either";
import { Just, Maybe, Nothing } from "./maybe";
import { constant, id, objectFromEntries, objectToEntries } from "./prelude";
import { StructuredError } from "./structuredError";

export type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [key: string]: Json };

type JsonPathKey = string | number;

export type DecoderError = StructuredError<
  JsonPathKey,
  { message: string; value: Json }
>;

export function isJson(a: unknown): a is Json {
  return (
    typeof a === "string" ||
    typeof a === "number" ||
    typeof a === "boolean" ||
    a === null ||
    (Array.isArray(a) && a.all(isJson)) ||
    (typeof a === "object" &&
      a != null &&
      objectToEntries(a)
        .map(x => x[0])
        .all(isJson))
  );
}

export function renderDecoderError(error: DecoderError): string[] {
  return StructuredError.render(
    error,
    key => `${typeof key === "string" ? "property" : "index"} ${key}`,
    ({ message, value }) => [
      message,
      `Offending value: ${JSON.stringify(value)}`,
    ],
  );
}

export class Decoder<T> {
  constructor(readonly decode: (json: Json) => Either<DecoderError, T>) {}

  public map<T2>(mapping: (t: T) => T2): Decoder<T2> {
    return new Decoder(x => this.decode(x).map(mapping));
  }

  public chain<T2>(getNextDecoder: (t: T) => Decoder<T2>): Decoder<T2> {
    return new Decoder(x =>
      this.decode(x).chain(y => getNextDecoder(y).decode(x)),
    );
  }

  public or<T2>(alt: Decoder<T2>): Decoder<T | T2> {
    return new Decoder(json =>
      this.decode(json).matchCase<Either<DecoderError, T | T2>>({
        left: error1 =>
          alt
            .decode(json)
            .mapLeft(error2 =>
              StructuredError.Or([
                ...(error1.tag === "Or" ? error1.value : [error1]),
                ...(error2.tag === "Or" ? error2.value : [error2]),
              ]),
            ),
        right: Right,
      }),
    );
  }
}

export class Encoder<T> {
  constructor(readonly encode: (value: T) => Json) {}

  public mapInput<T2>(mapping: (t: T2) => T): Encoder<T2> {
    return new Encoder(x => this.encode(mapping(x)));
  }

  public or<T2>(
    divide: (input: T | T2) => input is T2,
    alt: Encoder<T2>,
  ): Encoder<T | T2> {
    return new Encoder(input =>
      divide(input) ? alt.encode(input) : this.encode(input),
    );
  }
}

export const Decode = {
  string: new Decoder<string>(x =>
    typeof x === "string"
      ? Right(x)
      : Left(
          StructuredError.Failure({
            message: "Expected a string",
            value: x,
          }),
        ),
  ),
  boolean: new Decoder<boolean>(x =>
    typeof x === "boolean"
      ? Right(x)
      : Left(
          StructuredError.Failure({
            message: "Expected a boolean",
            value: x,
          }),
        ),
  ),
  number: new Decoder<number>(x =>
    typeof x === "number"
      ? Right(x)
      : Left(
          StructuredError.Failure({
            message: "Expected a number",
            value: x,
          }),
        ),
  ),
  nullable<T>(valueDecoder: Decoder<T>): Decoder<Maybe<T>> {
    return new Decoder(x =>
      x === null ? Right(Nothing()) : valueDecoder.decode(x).map(Just),
    );
  },
  array<T>(valueDecoder: Decoder<T>): Decoder<T[]> {
    return new Decoder(x => {
      if (Array.isArray(x)) {
        const results = x.map((x, i) =>
          valueDecoder
            .decode(x)
            .mapLeft(error => StructuredError.Path(i, error)),
        );
        const errors = lefts(results);

        return errors.isEmpty()
          ? Right(rights(results))
          : Left(StructuredError.Multiple(errors));
      } else {
        return Left(
          StructuredError.Failure({
            message: "Expected an array",
            value: x,
          }),
        );
      }
    });
  },
  field<T>(name: string, valueDecoder: Decoder<T>): Decoder<T> {
    return new Decoder(x => {
      if (x !== null && !Array.isArray(x) && typeof x === "object") {
        return x.hasOwnProperty(name)
          ? valueDecoder
              .decode(x[name])
              .mapLeft(error => StructuredError.Path(name, error))
          : Left(
              StructuredError.Failure({
                message: `Expected a field called ${name}`,
                value: x,
              }),
            );
      } else {
        return Left(
          StructuredError.Failure({
            message: "Expected an object",
            value: x,
          }),
        );
      }
    });
  },
  index<T>(index: number, valueDecoder: Decoder<T>): Decoder<T> {
    return new Decoder(x => {
      if (Array.isArray(x)) {
        return x[index] !== undefined
          ? valueDecoder
              .decode(x[index])
              .mapLeft(error => StructuredError.Path(index, error))
          : Left(
              StructuredError.Failure({
                message: `Expected index ${index} to exist`,
                value: x,
              }),
            );
      } else {
        return Left(
          StructuredError.Failure({
            message: "Expected an array",
            value: x,
          }),
        );
      }
    });
  },
  optional<T>(valueDecoder: Decoder<T>): Decoder<Maybe<T>> {
    return new Decoder(x =>
      x == null ? Right(Nothing()) : valueDecoder.decode(x).map(Just),
    );
  },
  value: new Decoder(Right),
  only<T>(value: T): Decoder<T> {
    return new Decoder(x =>
      (x as any) === value
        ? Right(value)
        : Left(
            StructuredError.Failure({
              message: `Expected ${value}`,
              value: x,
            }),
          ),
    );
  },
  enumOf<T>(...values: T[]): Decoder<T> {
    return new Decoder(x =>
      values.contains(x as any)
        ? Right(x as any)
        : Left(
            StructuredError.Failure({
              message: `Expected one of ${JSON.stringify(values)}`,
              value: x,
            }),
          ),
    );
  },
  fail(message: string): Decoder<any> {
    return new Decoder(value =>
      Left(
        StructuredError.Failure({
          message,
          value,
        }),
      ),
    );
  },
  succeed<T>(value: T): Decoder<T> {
    return new Decoder(constant(Right(value)));
  },
  record<T extends Record<string, any>>(
    spec: { [K in keyof T]: Decoder<T[K]> },
  ): Decoder<T> {
    return new Decoder(json => {
      if (json !== null && !Array.isArray(json) && typeof json === "object") {
        const results = objectToEntries(spec).map(([key, decoder]) =>
          decoder.decode(json).map<[keyof T, T[keyof T]]>(x => [key, x]),
        );
        const errors = lefts(results);

        return errors.isEmpty()
          ? Right(objectFromEntries(rights(results)))
          : Left(StructuredError.Multiple(errors));
      } else {
        return Left(
          StructuredError.Failure({
            message: "Expected an object",
            value: json,
          }),
        );
      }
    });
  },
  tuple<T extends any[]>(
    ...decoders: { [K in keyof T]: Decoder<T[K]> }
  ): Decoder<T> {
    return new Decoder(json => {
      if (Array.isArray(json)) {
        const results = decoders.map((decoder, i) =>
          Decode.index(i, decoder).decode(json),
        );
        const errors = lefts(results);

        return errors.isEmpty()
          ? Right(rights(results) as any)
          : Left(StructuredError.Multiple(errors));
      } else {
        return Left(
          StructuredError.Failure({
            message: "Expected an array",
            value: json,
          }),
        );
      }
    });
  },
};

export const Encode = {
  value: new Encoder<Json>(id),
  nullable<T>(valueEncoder: Encoder<T>): Encoder<Maybe<T>> {
    return new Encoder(x =>
      x.matchCase({ nothing: () => null, just: valueEncoder.encode }),
    );
  },
  array<T>(valueEncoder: Encoder<T>): Encoder<T[]> {
    return new Encoder(x => x.map(valueEncoder.encode));
  },
  field<T>(name: string, valueEncoder: Encoder<T>): Encoder<T> {
    return new Encoder(x => ({ [name]: valueEncoder.encode(x) }));
  },
  record<T extends Record<string, any>>(
    spec: { [K in keyof T]: Encoder<T[K]> },
  ): Encoder<T> {
    return new Encoder(
      value =>
        objectFromEntries(
          objectToEntries(spec).map<[keyof T, Json]>(([key, encoder]) => [
            key,
            encoder.encode(value[key]),
          ]) as any,
        ) as Json,
    );
  },
  tuple<T extends any[]>(
    ...encoders: { [K in keyof T]: K extends number ? Encoder<T[K]> : never }
  ): Encoder<T> {
    return new Encoder(value =>
      encoders.map((encoder, i) => encoder.encode(value[i])),
    );
  },
};
