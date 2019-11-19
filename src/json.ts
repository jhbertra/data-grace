import { replicate } from "./array";
import { Either, Left, lefts, Right, rights } from "./either";
import { Just, Maybe, Nothing } from "./maybe";
import {
  constant,
  Data,
  data,
  id,
  objectFromEntries,
  objectToEntries,
} from "./prelude";

export type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [key: string]: Json };

type JsonPathKey = string | number;

export type DecoderError =
  | Data<"Failure", { message: string; value: Json }>
  | Data<"Multiple", DecoderError[]>
  | Data<"Or", DecoderError[]>
  | Data<"Path", { key: JsonPathKey; error: DecoderError }>;

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

export function renderDecoderError(error: DecoderError): string {
  return renderDecoderErrorWithIndent(error, 0)
    .map(
      ([indent, line]) =>
        String.fromCodePoint(...replicate(indent * 4, 32)) + line,
    )
    .join("\n");
}

export function renderDecoderErrorWithIndent(
  error: DecoderError,
  indent: number,
): [number, string][] {
  switch (error.tag) {
    case "Failure":
      return [
        [indent + 1, error.value.message],
        [indent + 1, `Offending value: ${JSON.stringify(error.value)}`],
      ];

    case "Multiple":
      return error.value
        .map(x => renderDecoderErrorWithIndent(x, indent))
        .intersperse([[0, ""]])
        .chain(id);

    case "Or":
      let i = 1;
      return [
        [indent, "Several alternative decode attempts failed:"],
        ...error.value.chain<[number, string]>(x => [
          [indent + 1, `case ${i++}:`],
          ...renderDecoderErrorWithIndent(x, indent + 2),
        ]),
      ];

    case "Path":
      return [
        [
          indent,
          `At ${typeof error.value.key === "string" ? "property" : "index"} ${
            error.value.key
          }:`,
        ],
        ...renderDecoderErrorWithIndent(error.value.error, indent + 1),
      ];
  }
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
              data("Or", [
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
          data("Failure", {
            message: "Expected a string",
            value: x,
          }),
        ),
  ),
  boolean: new Decoder<boolean>(x =>
    typeof x === "boolean"
      ? Right(x)
      : Left(
          data("Failure", {
            message: "Expected a boolean",
            value: x,
          }),
        ),
  ),
  number: new Decoder<number>(x =>
    typeof x === "number"
      ? Right(x)
      : Left(
          data("Failure", {
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
          valueDecoder.decode(x).mapLeft<DecoderError>(error =>
            data("Path", {
              key: i,
              error,
            }),
          ),
        );
        const errors = lefts(results);

        return errors.isEmpty()
          ? Right(rights(results))
          : Left(data("Multiple", errors));
      } else {
        return Left(
          data("Failure", {
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
          ? valueDecoder.decode(x[name]).mapLeft<DecoderError>(error =>
              data("Path", {
                key: name,
                error,
              }),
            )
          : Left(
              data("Failure", {
                message: `Expected a field called ${name}`,
                value: x,
              }),
            );
      } else {
        return Left(
          data("Failure", {
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
          ? valueDecoder.decode(x[index]).mapLeft<DecoderError>(error =>
              data("Path", {
                key: index,
                error,
              }),
            )
          : Left(
              data("Failure", {
                message: `Expected index ${index} to exist`,
                value: x,
              }),
            );
      } else {
        return Left(
          data("Failure", {
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
            data("Failure", {
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
            data("Failure", {
              message: `Expected one of ${JSON.stringify(values)}`,
              value: x,
            }),
          ),
    );
  },
  fail(message: string): Decoder<any> {
    return new Decoder(value =>
      Left(
        data("Failure", {
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
          : Left(data("Multiple", errors));
      } else {
        return Left(
          data("Failure", {
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
          : Left(data("Multiple", errors));
      } else {
        return Left(
          data("Failure", {
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
