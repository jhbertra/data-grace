import { Either } from "./either";
import { Maybe } from "./maybe";
import {
  absurd,
  constant,
  id,
  objectFromEntries,
  objectToEntries,
  Constructors,
  Constructor,
  traverseObject,
} from "./prelude";
import { Schema } from "./schema";
import { StructuredError } from "./structuredError";

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export const Json = {
  decodeString<a>(decoder: Decoder<a>, value: string): Either<DecoderError, a> {
    try {
      return decoder.decode(JSON.parse(value));
    } catch (e) {
      return Either.Left(DecoderError.Failure({ message: "Expected a JSON string", value }));
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

export const DecoderError = Constructors({
  Failure: Constructor<{ message: string; value: Json }>(),
  Multiple: Constructor<DecoderError[]>(),
  Or: Constructor<DecoderError[]>(),
  Path: Constructor<{ key: JsonPathKey; error: DecoderError }>(),
});

export class Decoder<T> {
  constructor(readonly decode: (json: Json) => Either<DecoderError, T>) {}

  public map<T2>(mapping: (t: T) => T2): Decoder<T2> {
    return new Decoder(x => this.decode(x).map(mapping));
  }

  public chain<T2>(getNextDecoder: (t: T) => Decoder<T2>): Decoder<T2> {
    return new Decoder(x => this.decode(x).chain(y => getNextDecoder(y).decode(x)));
  }

  public filter(message: string, p: (t: T) => boolean): Decoder<T> {
    return new Decoder(x =>
      this.decode(x).chain(y =>
        p(y) ? Either.Right(y) : Either.Left(DecoderError.Failure({ message, value: x })),
      ),
    );
  }

  public or<T2>(alt: Decoder<T2>): Decoder<T | T2> {
    return new Decoder(json =>
      this.decode(json).matchCase<Either<DecoderError, T | T2>>({
        left: error1 =>
          alt
            .decode(json)
            .mapLeft(error2 =>
              DecoderError.Or([
                ...(error1.tag === "Or" ? error1.value : [error1]),
                ...(error2.tag === "Or" ? error2.value : [error2]),
              ]),
            ),
        right: Either.Right,
      }),
    );
  }

  public static schema<a>(schema: Schema<a, any>): Decoder<a> {
    switch (schema.tag) {
      case "Array":
        return schema.value((_schema, iso) => Decoder.array(Decoder.schema(_schema)).map(iso.to));

      case "Bool":
        return Decoder.boolean.map(schema.value.to);

      case "Combine":
        return schema.value((schema1, schema2, iso) =>
          Decoder.tuple(Decoder.schema(schema1), Decoder.schema(schema2)).map(iso.to),
        );

      case "Date":
        return Decoder.date.map(schema.value.to);

      case "Field":
        return Decoder.field(schema.value.field, Decoder.schema(schema.value.schema));

      case "Map":
        return schema.value((f, _schema) => Decoder.schema(_schema).map(f));

      case "Null":
        return Decoder.null.map(schema.value.to);

      case "Number":
        return Decoder.number.map(schema.value.to);

      case "Only":
        return Decoder.only(schema.value);

      case "Or":
        return Decoder.schema(schema.value[0]).or(Decoder.schema(schema.value[1]));

      case "Pure":
        return Decoder.succeed(schema.value);

      case "String":
        return Decoder.string.map(schema.value.to);

      case "Optional":
        return schema.value((_schema, iso) =>
          Decoder.optional(Decoder.schema(_schema)).map(iso.to),
        );

      case "Undefined":
        return Decoder.fail("JSON values cannot be undefined");

      default:
        return absurd(schema);
    }
  }

  public static string = new Decoder<string>(x =>
    typeof x === "string"
      ? Either.Right(x)
      : Either.Left(
          StructuredError.Failure({
            message: "Expected a string",
            value: x,
          }),
        ),
  );

  public static boolean = new Decoder<boolean>(x =>
    typeof x === "boolean"
      ? Either.Right(x)
      : Either.Left(
          StructuredError.Failure({
            message: "Expected a boolean",
            value: x,
          }),
        ),
  );

  public static date = new Decoder<Date>(x =>
    typeof x === "number"
      ? Either.Right(new Date(x))
      : Either.Left(
          StructuredError.Failure({
            message: "Expected a number convertible to a date",
            value: x,
          }),
        ),
  );

  public static number = new Decoder<number>(x =>
    typeof x === "number"
      ? Either.Right(x)
      : Either.Left(
          StructuredError.Failure({
            message: "Expected a number",
            value: x,
          }),
        ),
  );

  public static null = new Decoder<null>(x =>
    typeof x === "object" && x === null
      ? Either.Right(x)
      : Either.Left(
          StructuredError.Failure({
            message: "Expected a null",
            value: x,
          }),
        ),
  );

  public static nullable<T>(valueDecoder: Decoder<T>): Decoder<Maybe<T>> {
    return new Decoder(x =>
      x === null ? Either.Right(Maybe.Nothing()) : valueDecoder.decode(x).map(Maybe.Just),
    );
  }

  public static array<T>(valueDecoder: Decoder<T>): Decoder<T[]> {
    return new Decoder(x => {
      if (Array.isArray(x)) {
        const results = x.map((x, i) =>
          valueDecoder.decode(x).mapLeft(error => StructuredError.Path(i, error)),
        );
        const errors = Either.lefts(results);

        return errors.isEmpty()
          ? Either.Right(Either.rights(results))
          : Either.Left(DecoderError.Multiple(errors));
      } else {
        return Either.Left(
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
          ? valueDecoder.decode(x[name]).mapLeft(error => StructuredError.Path(name, error))
          : Either.Left(
              StructuredError.Failure({
                message: `Expected a field called ${name}`,
                value: x,
              }),
            );
      } else {
        return Either.Left(
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
          ? valueDecoder.decode(x[index]).mapLeft(error => StructuredError.Path(index, error))
          : Either.Left(
              StructuredError.Failure({
                message: `Expected index ${index} to exist`,
                value: x,
              }),
            );
      } else {
        return Either.Left(
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
      x === null ? Either.Right(Maybe.Nothing()) : valueDecoder.decode(x).map(Maybe.Just),
    );
  }

  public static value = new Decoder(Either.Right);

  public static only<T>(value: T): Decoder<T> {
    return new Decoder(x =>
      (x as any) === value
        ? Either.Right(value)
        : Either.Left(
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
        ? Either.Right(x as any)
        : Either.Left(
            StructuredError.Failure({
              message: `Expected one of ${JSON.stringify(values)}`,
              value: x,
            }),
          ),
    );
  }

  public static fail(message: string): Decoder<any> {
    return new Decoder(value =>
      Either.Left(
        StructuredError.Failure({
          message,
          value,
        }),
      ),
    );
  }

  public static succeed<T>(value: T): Decoder<T> {
    return new Decoder(constant(Either.Right(value)));
  }

  public static record<T extends Record<string, any>>(
    spec: { [K in keyof T]: Decoder<T[K]> },
  ): Decoder<T> {
    return new Decoder(json => {
      if (json !== null && !Array.isArray(json) && typeof json === "object") {
        const results = objectToEntries(spec).map(([key, decoder]) =>
          decoder.decode(json).map<[keyof T, T[keyof T]]>(x => [key, x]),
        );
        const errors = Either.lefts(results);

        return errors.isEmpty()
          ? Either.Right(objectFromEntries(Either.rights(results)))
          : Either.Left(DecoderError.Multiple(errors));
      } else {
        return Either.Left(
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
        const errors = Either.lefts(results);

        return errors.isEmpty()
          ? Either.Right(Either.rights(results) as any)
          : Either.Left(DecoderError.Multiple(errors));
      } else {
        return Either.Left(
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

  public mapInput<T2>(mapping: (t: T2) => T): Encoder<T2> {
    return new Encoder(x => this.encode(mapping(x)));
  }

  public or<T2>(divide: (input: T | T2) => input is T2, alt: Encoder<T2>): Encoder<T | T2> {
    return new Encoder(input => (divide(input) ? alt.encode(input) : this.encode(input)));
  }

  public static value = new Encoder<Json>(id);

  public static nullable<T>(valueEncoder: Encoder<T>): Encoder<Maybe<T>> {
    return new Encoder(x => x.matchCase({ nothing: () => null, just: valueEncoder.encode }));
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
