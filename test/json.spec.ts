import * as fc from "fast-check";
import {
  DecoderError,
  Result,
  StructuredError,
  Maybe,
  Decoder,
  Json,
  JsonPathKey,
  JsonError,
} from "../src";
import { constant, id } from "../src/prelude";
import { arbitraryEither } from "./result.spec";

describe("decodeString", () => {
  it("Fails for invalid JSON", () => {
    fc.assert(
      fc.property(
        fc.string().filter(x => {
          try {
            JSON.parse(x);
            return false;
          } catch {
            return true;
          }
        }),
        s => {
          expect(Json.decodeString(Decoder.value, s)).toEqual(
            Result.Error(StructuredError.Failure({ message: "Expected a JSON string", value: s })),
          );
        },
      ),
    );
  });
  it("Succeeds for valid JSON", () => {
    fc.assert(
      fc.property(fc.json(), json => {
        expect(Json.decodeString(Decoder.value, json)).toEqual(Result.Ok(JSON.parse(json)));
      }),
    );
  });
});

describe("isJson", () => {
  it("Returns true for valid JSON", () => {
    fc.assert(
      fc.property(fc.jsonObject(), json => {
        expect(Json.isJson(json)).toEqual(true);
      }),
    );
  });
  it("Returns false for functions", () => {
    fc.assert(
      fc.property(fc.func(fc.anything()), fn => {
        expect(Json.isJson(fn)).toEqual(false);
      }),
    );
  });
  it("Returns false for undefined", () => {
    expect(Json.isJson(undefined)).toEqual(false);
  });
  it("Returns false for NaN", () => {
    expect(Json.isJson(NaN)).toEqual(false);
  });
  it("Returns false for symbols", () => {
    expect(Json.isJson(Symbol.for("asdf"))).toEqual(false);
  });
});

describe("renderDecoderError", () => {
  it("Renders human-readable text for Failures", () => {
    fc.assert(
      fc.property(fc.string(), fc.jsonObject() as fc.Arbitrary<Json>, (message, value) => {
        expect(Json.renderDecoderError(StructuredError.Failure({ message, value }))).toEqual(
          `${message}
Offending value: ${JSON.stringify(value)}`,
        );
      }),
    );
  });
  it("Renders human-readable text for Multiples", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc
            .record({ message: fc.string(), value: fc.jsonObject() as fc.Arbitrary<Json> })
            .map<DecoderError>(StructuredError.Failure),
        ),
        errors => {
          expect(Json.renderDecoderError(StructuredError.Multiple(errors))).toEqual(
            errors
              .map(error => Json.renderDecoderError(error))
              .intersperse("")
              .join("\n"),
          );
        },
      ),
    );
  });
  it("Renders human-readable text for Ors", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc
            .record({ message: fc.string(), value: fc.jsonObject() as fc.Arbitrary<Json> })
            .map<DecoderError>(StructuredError.Failure),
        ),
        errors => {
          expect(Json.renderDecoderError(StructuredError.Or(errors))).toEqual(
            [
              "Several alternatives failed:",
              ...errors.map(
                (error, i) =>
                  `    case ${i + 1}:\n` +
                  Json.renderDecoderError(error)
                    .split("\n")
                    .map(x => `        ${x}`)
                    .join("\n"),
              ),
            ].join("\n"),
          );
        },
      ),
    );
  });
  it("Renders human-readable text for Paths", () => {
    fc.assert(
      fc.property(
        fc.oneof<string | number>(fc.string(), fc.nat()),
        fc.string(),
        fc.jsonObject() as fc.Arbitrary<Json>,
        (path, message, value) => {
          expect(
            Json.renderDecoderError(
              StructuredError.Path(path, StructuredError.Failure({ message, value })),
            ),
          ).toEqual(
            `At ${typeof path === "number" ? "index" : "property"} ${path}:
    ${message}
    Offending value: ${JSON.stringify(value)}`,
          );
        },
      ),
    );
  });
});

describe("chain", () => {
  it("short circuits if the first Form fails", () => {
    expect(
      Decoder.fail("Fail")
        .chain(constant(Decoder.succeed("test")))
        .decode(null),
    ).toEqual(Result.Error(StructuredError.Failure({ message: "Fail", value: null })));
  });
  it("runs the second Form if the first Form fails", () => {
    expect(
      Decoder.succeed("first")
        .chain(constant(Decoder.succeed("test")))
        .decode(null),
    ).toEqual(Result.Ok("test"));
  });
});

describe("decode", () => {
  it("returns the result of the validator fn", () => {
    fc.assert(
      fc.property(arbitraryEither(arbitraryDecoderError, fc.anything()), x => {
        expect(new Decoder(() => x).decode(null)).toEqual(x);
      }),
    );
  });
});

describe("map", () => {
  it("transforms the result", () => {
    fc.assert(
      fc.property(arbitraryEither(arbitraryDecoderError, fc.anything()), result => {
        expect(new Decoder(() => result).map(x => typeof x === "string").decode(null)).toEqual(
          result.map(x => typeof x === "string"),
        );
      }),
    );
  });
});

describe("or", () => {
  it("picks the first successful form", () => {
    fc.assert(
      fc.property(
        arbitraryEither(arbitraryDecoderError, fc.anything()),
        arbitraryEither(arbitraryDecoderError, fc.anything()),
        arbitraryEither(arbitraryDecoderError, fc.anything()),
        (result1, result2, result3) => {
          expect(
            new Decoder(() => result1)
              .or(new Decoder(() => result2))
              .or(new Decoder(() => result3))
              .decode(null),
          ).toEqual(
            result1.isError && result2.isError && result3.isError
              ? Result.Error(
                  StructuredError.Or(
                    Maybe.catMaybes([
                      result1.maybeError,
                      result2.maybeError,
                      result3.maybeError,
                    ]).chain(error => (error.data.tag === "Or" ? error.data.value : [error])),
                  ),
                )
              : result1.or(result2).or(result3),
          );
        },
      ),
    );
  });
});

describe("record", () => {
  it("Constructs an object", () => {
    fc.assert(
      fc.property(
        fc.record({
          foo: fc.string(),
          bar: fc.integer(),
          baz: fc.boolean(),
        }),
        value => {
          expect(
            Decoder.record({
              foo: Decoder.field("foo", Decoder.string),
              bar: Decoder.field("bar", Decoder.number),
              baz: Decoder.field("baz", Decoder.boolean),
            }).decode(value),
          ).toEqual(Result.Ok(value));
        },
      ),
    );
  });

  it("Constructs errors", () => {
    fc.assert(
      fc.property(
        fc.record({
          foo: fc.string(),
          bar: fc.integer(),
          baz: fc.boolean(),
        }),
        value => {
          expect(
            Decoder.record({
              foo: Decoder.field("foo", Decoder.fail("Foo failed")),
              bar: Decoder.field("bar", Decoder.fail("Bar failed")),
              baz: Decoder.field("baz", Decoder.fail("Baz failed")),
            }).decode(value),
          ).toEqual(
            Result.Error(
              StructuredError.Multiple<JsonPathKey, JsonError>([
                StructuredError.Path(
                  "foo",
                  StructuredError.Failure({ message: "Foo failed", value: value.foo }),
                ),
                StructuredError.Path(
                  "bar",
                  StructuredError.Failure({ message: "Bar failed", value: value.bar }),
                ),
                StructuredError.Path(
                  "baz",
                  StructuredError.Failure({ message: "Baz failed", value: value.baz }),
                ),
              ]),
            ),
          );
        },
      ),
    );
  });
  it("Fails for non-objects", () => {
    fc.assert(
      fc.property(
        fc
          .jsonObject()
          .filter(x => x === null || Array.isArray(x) || typeof x !== "object") as fc.Arbitrary<
          Json
        >,
        value => {
          expect(
            Decoder.record({
              foo: Decoder.field("foo", Decoder.fail("Foo failed")),
              bar: Decoder.field("bar", Decoder.fail("Bar failed")),
              baz: Decoder.field("baz", Decoder.fail("Baz failed")),
            }).decode(value),
          ).toEqual(
            Result.Error(StructuredError.Failure({ message: "Expected an object", value: value })),
          );
        },
      ),
    );
  });
});

describe("tuple", () => {
  it("Constructs an object", () => {
    fc.assert(
      fc.property(fc.tuple(fc.string(), fc.integer(), fc.boolean()), value => {
        expect(
          Decoder.tuple(Decoder.string, Decoder.number, Decoder.boolean).decode(value),
        ).toEqual(Result.Ok(value));
      }),
    );
  });

  it("Constructs errors", () => {
    fc.assert(
      fc.property(fc.tuple(fc.string(), fc.integer(), fc.boolean()), value => {
        expect(
          Decoder.tuple(
            Decoder.fail("Foo failed"),
            Decoder.fail("Bar failed"),
            Decoder.fail("Baz failed"),
          ).decode(value),
        ).toEqual(
          Result.Error(
            StructuredError.Multiple<JsonPathKey, JsonError>([
              StructuredError.Path(
                0,
                StructuredError.Failure({ message: "Foo failed", value: value[0] }),
              ),
              StructuredError.Path(
                1,
                StructuredError.Failure({ message: "Bar failed", value: value[1] }),
              ),
              StructuredError.Path(
                2,
                StructuredError.Failure({ message: "Baz failed", value: value[2] }),
              ),
            ]),
          ),
        );
      }),
    );
  });
  it("Fails for non-arrays", () => {
    fc.assert(
      fc.property(fc.jsonObject().filter(x => !Array.isArray(x)) as fc.Arbitrary<Json>, value => {
        expect(
          Decoder.tuple(Decoder.string, Decoder.number, Decoder.boolean).decode(value),
        ).toEqual(Result.Error(StructuredError.Failure({ message: "Expected an array", value })));
      }),
    );
  });
});

describe("boolean", () => {
  it("Decodes booleans", () => {
    fc.assert(
      fc.property(fc.jsonObject() as fc.Arbitrary<Json>, value => {
        expect(Decoder.boolean.decode(value)).toEqual(
          typeof value === "boolean"
            ? Result.Ok(value)
            : Result.Error(StructuredError.Failure({ message: "Expected a boolean", value })),
        );
      }),
    );
  });
});

describe("date", () => {
  it("Decodes unix timestamps", () => {
    fc.assert(
      fc.property(fc.jsonObject() as fc.Arbitrary<Json>, value => {
        expect(Decoder.date.decode(value)).toEqual(
          typeof value === "number"
            ? Result.Ok(new Date(value))
            : Result.Error(
                StructuredError.Failure({
                  message: "Expected a number convertible to a date",
                  value,
                }),
              ),
        );
      }),
    );
  });
});

describe("number", () => {
  it("Decodes numbers", () => {
    fc.assert(
      fc.property(fc.jsonObject() as fc.Arbitrary<Json>, value => {
        expect(Decoder.number.decode(value)).toEqual(
          typeof value === "number"
            ? Result.Ok(value)
            : Result.Error(
                StructuredError.Failure({
                  message: "Expected a number",
                  value,
                }),
              ),
        );
      }),
    );
  });
});

describe("null", () => {
  it("Decodes nulls", () => {
    fc.assert(
      fc.property(fc.jsonObject() as fc.Arbitrary<Json>, value => {
        expect(Decoder.null.decode(value)).toEqual(
          value === null
            ? Result.Ok(value)
            : Result.Error(
                StructuredError.Failure({
                  message: "Expected a null",
                  value,
                }),
              ),
        );
      }),
    );
  });
});

describe("string", () => {
  it("Decodes strings", () => {
    fc.assert(
      fc.property(fc.jsonObject() as fc.Arbitrary<Json>, value => {
        expect(Decoder.string.decode(value)).toEqual(
          typeof value === "string"
            ? Result.Ok(value)
            : Result.Error(StructuredError.Failure({ message: "Expected a string", value })),
        );
      }),
    );
  });
});

describe("nullable", () => {
  it("Decodes nulls", () => {
    fc.assert(
      fc.property(arbitraryDecoder, decoder => {
        expect(Decoder.nullable(decoder).decode(null)).toEqual(Result.Ok(Maybe.Nothing()));
      }),
    );
  });
  it("Decodes what the inner decoder decodes", () => {
    fc.assert(
      fc.property(
        arbitraryDecoder,
        fc.jsonObject().filter(x => x !== null) as fc.Arbitrary<Json>,
        (decoder, value) => {
          expect(Decoder.nullable(decoder).decode(value)).toEqual(
            decoder.decode(value).map(Maybe.Just),
          );
        },
      ),
    );
  });
});

describe("optional", () => {
  it("Decodes what the inner decoder decodes", () => {
    fc.assert(
      fc.property(
        arbitraryDecoder,
        fc.jsonObject().filter(x => x !== null) as fc.Arbitrary<Json>,
        (decoder, value) => {
          expect(Decoder.optional(decoder).decode(value)).toEqual(
            Result.Ok(
              decoder
                .decode(value)
                .map(Maybe.Just)
                .defaultWith(Maybe.Nothing()),
            ),
          );
        },
      ),
    );
  });
});

describe("array", () => {
  it("Decodes empty arrays", () => {
    fc.assert(
      fc.property(arbitraryDecoder, decoder => {
        expect(Decoder.array(decoder).decode([])).toEqual(Result.Ok([]));
      }),
    );
  });
  it("Decodes what the inner decoder decodes", () => {
    fc.assert(
      fc.property(
        arbitraryDecoder,
        fc.array(fc.jsonObject().filter(x => x !== null) as fc.Arbitrary<Json>),
        (decoder, value) => {
          const results = value.map(decoder.decode);
          const errors = Result.errors(
            results.map((result, i) => result.mapError(error => StructuredError.Path(i, error))),
          );
          const values = Result.oks(results);
          expect(Decoder.array(decoder).decode(value)).toEqual(
            errors.isEmpty() ? Result.Ok(values) : Result.Error(StructuredError.Multiple(errors)),
          );
        },
      ),
    );
  });
  it("Fails for non-arrays", () => {
    fc.assert(
      fc.property(
        arbitraryDecoder,
        fc.jsonObject().filter(x => !Array.isArray(x)) as fc.Arbitrary<Json>,
        (decoder, value) => {
          expect(Decoder.array(decoder).decode(value)).toEqual(
            Result.Error(StructuredError.Failure({ message: "Expected an array", value })),
          );
        },
      ),
    );
  });
});

describe("filter", () => {
  it("Fails if the predicate fails", () => {
    fc.assert(
      fc.property(fc.boolean(), succeed => {
        expect(Decoder.boolean.filter("Failure from predicate", id).decode(succeed)).toEqual(
          succeed
            ? Result.Ok(true)
            : Result.Error(
                StructuredError.Failure({ message: "Failure from predicate", value: false }),
              ),
        );
      }),
    );
  });
});

describe("field", () => {
  it("Decodes what the inner decoder decodes", () => {
    fc.assert(
      fc.property(
        arbitraryDecoder,
        fc.string(1, 10),
        fc.jsonObject() as fc.Arbitrary<Json>,
        (decoder, fieldName, value) => {
          expect(Decoder.field(fieldName, decoder).decode({ [fieldName]: value })).toEqual(
            decoder.decode(value).mapError(error => StructuredError.Path(fieldName, error)),
          );
        },
      ),
    );
  });
  it("Fails if field not found", () => {
    fc.assert(
      fc.property(arbitraryDecoder, fc.string(1, 10), (decoder, fieldName) => {
        expect(Decoder.field(fieldName, decoder).decode({})).toEqual(
          Result.Error(
            StructuredError.Failure({ message: "Expected a field called " + fieldName, value: {} }),
          ),
        );
      }),
    );
  });
  it("Fails for non-objects", () => {
    fc.assert(
      fc.property(
        arbitraryDecoder,
        fc.string(1, 10),
        fc
          .jsonObject()
          .filter(x => x === null || Array.isArray(x) || typeof x !== "object") as fc.Arbitrary<
          Json
        >,
        (decoder, fieldName, value) => {
          expect(Decoder.field(fieldName, decoder).decode(value)).toEqual(
            Result.Error(StructuredError.Failure({ message: "Expected an object", value: value })),
          );
        },
      ),
    );
  });
});

describe("only", () => {
  it("Decodes the value it is passed", () => {
    fc.assert(
      fc.property(fc.jsonObject() as fc.Arbitrary<Json>, value => {
        expect(Decoder.only(value).decode(value)).toEqual(Result.Ok(value));
      }),
    );
  });
  it("Fails everything else", () => {
    fc.assert(
      fc.property(
        fc
          .tuple(fc.jsonObject(), fc.jsonObject())
          .filter(([x, y]) => JSON.stringify(x) !== JSON.stringify(y)) as fc.Arbitrary<
          [Json, Json]
        >,
        ([value1, value2]) => {
          expect(Decoder.only(value1).decode(value2)).toEqual(
            Result.Error(StructuredError.Failure({ message: "Expected " + value1, value: value2 })),
          );
        },
      ),
    );
  });
});

describe("enumOf", () => {
  it("Decodes any of the values it is passed", () => {
    fc.assert(
      fc.property(
        fc
          .array(fc.jsonObject() as fc.Arbitrary<Json>, 1, 10)
          .chain(values => fc.tuple(fc.constant(values), fc.integer(0, values.length - 1))),
        ([values, index]) => {
          expect(Decoder.enumOf(...values).decode(values[index])).toEqual(Result.Ok(values[index]));
        },
      ),
    );
  });
  it("Fails everything else", () => {
    fc.assert(
      fc.property(
        fc
          .tuple(fc.array(fc.jsonObject(), 1, 10), fc.jsonObject())
          .filter(([values, value]) =>
            values.all(x => JSON.stringify(x) !== JSON.stringify(value)),
          ) as fc.Arbitrary<[Json[], Json]>,
        ([values, value]) => {
          expect(Decoder.enumOf(...values).decode(value)).toEqual(
            Result.Error(
              StructuredError.Failure({
                message: "Expected one of " + JSON.stringify(values),
                value: value,
              }),
            ),
          );
        },
      ),
    );
  });
});

describe("index", () => {
  it("Decodes what the inner decoder decodes", () => {
    fc.assert(
      fc.property(
        arbitraryDecoder,
        fc.nat(),
        fc.jsonObject() as fc.Arbitrary<Json>,
        (decoder, index, value) => {
          const array = new Array();
          array[index] = value;
          expect(Decoder.index(index, decoder).decode(array)).toEqual(
            decoder.decode(value).mapError(error => StructuredError.Path(index, error)),
          );
        },
      ),
    );
  });
  it("Fails if index not found", () => {
    fc.assert(
      fc.property(arbitraryDecoder, fc.nat(), (decoder, index) => {
        expect(Decoder.index(index, decoder).decode([])).toEqual(
          Result.Error(
            StructuredError.Failure({
              message: "Expected index " + index + " to exist",
              value: [],
            }),
          ),
        );
      }),
    );
  });
  it("Fails for non-arrays", () => {
    fc.assert(
      fc.property(
        arbitraryDecoder,
        fc.nat(),
        fc.jsonObject().filter(x => !Array.isArray(x)) as fc.Arbitrary<Json>,
        (decoder, index, value) => {
          expect(Decoder.index(index, decoder).decode(value)).toEqual(
            Result.Error(StructuredError.Failure({ message: "Expected an array", value: value })),
          );
        },
      ),
    );
  });
});

const arbitraryFailure = fc
  .record({ value: fc.jsonObject() as fc.Arbitrary<Json>, message: fc.string() })
  .map<DecoderError>(StructuredError.Failure);

const arbitraryDecoderError: fc.Arbitrary<DecoderError> = fc.oneof<DecoderError>(
  arbitraryFailure,
  fc.array(arbitraryFailure).map(StructuredError.Multiple),
  fc.array(arbitraryFailure).map(StructuredError.Or),
  fc
    .tuple(fc.oneof<string | number>(fc.string(), fc.nat()), arbitraryFailure)
    .map(([path, error]) => StructuredError.Path(path, error)),
);

const arbitraryDecoder = fc.constantFrom<Decoder<any>>(
  Decoder.boolean,
  Decoder.date,
  Decoder.number,
  Decoder.string,
);
