import { Result } from "./result";
import { Maybe } from "./maybe";
import {
  constant,
  id,
  objectFromEntries,
  objectToEntries,
  traverseObject,
  Union,
  UnionMember,
} from "./prelude";
import { StructuredError } from "./structuredError";

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export const Json = {
  decodeString<a>(decoder: Decoder<a>, value: string): Result<a, DecoderError> {
    try {
      return decoder.decode(JSON.parse(value));
    } catch (e) {
      return Result.Error(DecoderError.Failure({ message: "Expected a JSON string", value }));
    }
  },
  encodeString<a>(encoder: Encoder<a>, value: a): string {
    return JSON.stringify(encoder.encode(value));
  },
  isJson(a: unknown): a is Json {
    return (
      typeof a === "string" ||
      typeof a === "number" ||
      typeof a === "boolean" ||
      a === null ||
      (Array.isArray(a) && a.all(Json.isJson)) ||
      (typeof a === "object" &&
        a !== null &&
        objectToEntries(a)
          .map(x => x[0])
          .all(Json.isJson))
    );
  },
  renderDecoderError(error: DecoderError): string[] {
    return StructuredError.render(
      error,
      key => `${typeof key === "string" ? "property" : "index"} ${key}`,
      ({ message, value }) => [message, `Offending value: ${JSON.stringify(value)}`],
    );
  },
};

export type JsonPathKey = string | number;

export type DecoderError = StructuredError<JsonPathKey, { message: string; value: Json }>;

export const DecoderError = Union({
  Failure: UnionMember<{ message: string; value: Json }>(),
  Multiple: UnionMember<DecoderError[]>(),
  Or: UnionMember<DecoderError[]>(),
  Path: UnionMember<{ key: JsonPathKey; error: DecoderError }>(),
});

export class Decoder<a> {
  constructor(readonly decode: (json: Json) => Result<a, DecoderError>) {}

  public map<b>(mapping: (a: a) => b): Decoder<b> {
    return new Decoder(x => this.decode(x).map(mapping));
  }

  public chain<b>(getNextDecoder: (a: a) => Decoder<b>): Decoder<b> {
    return new Decoder(x => this.decode(x).chain(y => getNextDecoder(y).decode(x)));
  }

  public filter(message: string, p: (a: a) => boolean): Decoder<a> {
    return new Decoder(x =>
      this.decode(x).chain(y =>
        p(y) ? Result.Ok(y) : Result.Error(DecoderError.Failure({ message, value: x })),
      ),
    );
  }

  public or<b>(alt: Decoder<b>): Decoder<a | b> {
    return new Decoder(json =>
      this.decode(json).matchCase<Result<a | b, DecoderError>>({
        Error: error1 =>
          alt
            .decode(json)
            .mapError(error2 =>
              DecoderError.Or([
                ...(error1.tag === "Or" ? error1.value : [error1]),
                ...(error2.tag === "Or" ? error2.value : [error2]),
              ]),
            ),
        Ok: Result.Ok,
      }),
    );
  }

  public static string = new Decoder<string>(x =>
    typeof x === "string"
      ? Result.Ok(x)
      : Result.Error(
          StructuredError.Failure({
            message: "Expected a string",
            value: x,
          }),
        ),
  );

  public static boolean = new Decoder<boolean>(x =>
    typeof x === "boolean"
      ? Result.Ok(x)
      : Result.Error(
          StructuredError.Failure({
            message: "Expected a boolean",
            value: x,
          }),
        ),
  );

  public static date = new Decoder<Date>(x =>
    typeof x === "number"
      ? Result.Ok(new Date(x))
      : Result.Error(
          StructuredError.Failure({
            message: "Expected a number convertible to a date",
            value: x,
          }),
        ),
  );

  public static number = new Decoder<number>(x =>
    typeof x === "number"
      ? Result.Ok(x)
      : Result.Error(
          StructuredError.Failure({
            message: "Expected a number",
            value: x,
          }),
        ),
  );

  public static null = new Decoder<null>(x =>
    typeof x === "object" && x === null
      ? Result.Ok(x)
      : Result.Error(
          StructuredError.Failure({
            message: "Expected a null",
            value: x,
          }),
        ),
  );

  public static nullable<T>(valueDecoder: Decoder<T>): Decoder<Maybe<T>> {
    return new Decoder(x =>
      x === null ? Result.Ok(Maybe.Nothing()) : valueDecoder.decode(x).map(Maybe.Just),
    );
  }

  public static array<T>(valueDecoder: Decoder<T>): Decoder<T[]> {
    return new Decoder(x => {
      if (Array.isArray(x)) {
        const results = x.map((x, i) =>
          valueDecoder.decode(x).mapError(error => StructuredError.Path(i, error)),
        );
        const errors = Result.errors(results);

        return errors.isEmpty()
          ? Result.Ok(Result.oks(results))
          : Result.Error(DecoderError.Multiple(errors));
      } else {
        return Result.Error(
          StructuredError.Failure({
            message: "Expected an array",
            value: x,
          }),
        );
      }
    });
  }

  public static field<T>(name: string, valueDecoder: Decoder<T>): Decoder<T> {
    return new Decoder(x => {
      if (x !== null && !Array.isArray(x) && typeof x === "object") {
        return x.hasOwnProperty(name)
          ? valueDecoder.decode(x[name]).mapError(error => StructuredError.Path(name, error))
          : Result.Error(
              StructuredError.Failure({
                message: `Expected a field called ${name}`,
                value: x,
              }),
            );
      } else {
        return Result.Error(
          StructuredError.Failure({
            message: "Expected an object",
            value: x,
          }),
        );
      }
    });
  }

  public static index<T>(index: number, valueDecoder: Decoder<T>): Decoder<T> {
    return new Decoder(x => {
      if (Array.isArray(x)) {
        // tslint:disable-next-line: strict-type-predicates
        return x[index] !== undefined
          ? valueDecoder.decode(x[index]).mapError(error => StructuredError.Path(index, error))
          : Result.Error(
              StructuredError.Failure({
                message: `Expected index ${index} to exist`,
                value: x,
              }),
            );
      } else {
        return Result.Error(
          StructuredError.Failure({
            message: "Expected an array",
            value: x,
          }),
        );
      }
    });
  }

  public static optional<T>(valueDecoder: Decoder<T>): Decoder<Maybe<T>> {
    return new Decoder(x =>
      x === null ? Result.Ok(Maybe.Nothing()) : valueDecoder.decode(x).map(Maybe.Just),
    );
  }

  public static value = new Decoder(Result.Ok);

  public static only<T>(value: T): Decoder<T> {
    return new Decoder(x =>
      (x as any) === value
        ? Result.Ok(value)
        : Result.Error(
            StructuredError.Failure({
              message: `Expected ${value}`,
              value: x,
            }),
          ),
    );
  }

  public static enumOf<T>(...values: T[]): Decoder<T> {
    return new Decoder(x =>
      values.contains(x as any)
        ? Result.Ok(x as any)
        : Result.Error(
            StructuredError.Failure({
              message: `Expected one of ${JSON.stringify(values)}`,
              value: x,
            }),
          ),
    );
  }

  public static fail(message: string): Decoder<any> {
    return new Decoder(value =>
      Result.Error(
        StructuredError.Failure({
          message,
          value,
        }),
      ),
    );
  }

  public static succeed<T>(value: T): Decoder<T> {
    return new Decoder(constant(Result.Ok(value)));
  }

  public static record<T extends Record<string, any>>(
    spec: { [K in keyof T]: Decoder<T[K]> },
  ): Decoder<T> {
    return new Decoder(json => {
      if (json !== null && !Array.isArray(json) && typeof json === "object") {
        const results = objectToEntries(spec).map(([key, decoder]) =>
          decoder.decode(json).map<[keyof T, T[keyof T]]>(x => [key, x]),
        );
        const errors = Result.errors(results);

        return errors.isEmpty()
          ? Result.Ok(objectFromEntries(Result.oks(results)))
          : Result.Error(DecoderError.Multiple(errors));
      } else {
        return Result.Error(
          StructuredError.Failure({
            message: "Expected an object",
            value: json,
          }),
        );
      }
    });
  }

  public static tuple<T extends any[]>(...decoders: { [K in keyof T]: Decoder<T[K]> }): Decoder<T> {
    return new Decoder(json => {
      if (Array.isArray(json)) {
        const results = decoders.map((decoder, i) => Decoder.index(i, decoder).decode(json));
        const errors = Result.errors(results);

        return errors.isEmpty()
          ? Result.Ok(Result.oks(results) as any)
          : Result.Error(DecoderError.Multiple(errors));
      } else {
        return Result.Error(
          StructuredError.Failure({
            message: "Expected an array",
            value: json,
          }),
        );
      }
    });
  }
}

export class Encoder<T> {
  constructor(readonly encode: (value: T) => Json) {}

  public mapInput<b>(mapping: (t: b) => T): Encoder<b> {
    return new Encoder(x => this.encode(mapping(x)));
  }

  public or<b>(divide: (input: T | b) => input is b, alt: Encoder<b>): Encoder<T | b> {
    return new Encoder(input => (divide(input) ? alt.encode(input) : this.encode(input)));
  }

  public static value = new Encoder<Json>(id);

  public static nullable<T>(valueEncoder: Encoder<T>): Encoder<Maybe<T>> {
    return new Encoder(x => x.matchCase({ Nothing: () => null, Just: valueEncoder.encode }));
  }

  public static array<T>(valueEncoder: Encoder<T>): Encoder<T[]> {
    return new Encoder(x => x.map(valueEncoder.encode));
  }

  public static field<T>(name: string, valueEncoder: Encoder<T>): Encoder<T> {
    return new Encoder(x => ({ [name]: valueEncoder.encode(x) }));
  }

  public static record<T extends Record<string, any>>(
    spec: { [K in keyof T]: Encoder<T[K]> },
  ): Encoder<T> {
    return new Encoder(
      value => traverseObject(spec, (key, encoder) => encoder.encode(value[key]) as any) as Json,
    );
  }

  public static tuple<T extends any[]>(
    ...encoders: { [K in keyof T]: K extends number ? Encoder<T[K]> : never }
  ): Encoder<T> {
    return new Encoder(value => encoders.map((encoder, i) => encoder.encode(value[i])));
  }
}
