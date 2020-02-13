import * as fc from "fast-check";
import { Form, FormError, Result, StructuredError, Maybe } from "../src";
import { simplify, constant, id } from "../src/prelude";
import { arbitraryEither } from "./result.spec";
import { and } from "../src/array";

describe("chain", () => {
  it("short circuits if the first Form fails", () => {
    expect(
      simplify(
        Form.fail(undefined, StructuredError.Failure("Fail"))
          .chain(constant(Form.succeed(undefined, "test")))
          .getResult(),
      ),
    ).toEqual(simplify(Result.Error(StructuredError.Failure("Fail"))));
  });
  it("runs the second Form if the first Form fails", () => {
    expect(
      simplify(
        Form.succeed(undefined, "first")
          .chain(constant(Form.succeed(undefined, "test")))
          .getResult(),
      ),
    ).toEqual(simplify(Result.Ok("test")));
  });
});

describe("getResult", () => {
  it("returns the result of the validator fn", () => {
    fc.assert(
      fc.property(arbitraryEither(arbitraryFormError, fc.anything()), x => {
        expect(simplify(Form.text(constant(x)).getResult())).toEqual(simplify(x));
      }),
    );
  });
});

describe("load", () => {
  it("sets the value of the form", () => {
    fc.assert(
      fc.property(
        fc.string(),
        arbitraryEither(arbitraryFormError, fc.anything()),
        (value, result) => {
          expect(Form.text(constant(result)).load(value).value).toEqual(value);
        },
      ),
    );
  });
  it("does not set the dirty flag", () => {
    fc.assert(
      fc.property(
        fc.string(),
        arbitraryEither(arbitraryFormError, fc.anything()),
        (value, result) => {
          expect(Form.text(constant(result)).load(value).dirty).toEqual(false);
        },
      ),
    );
  });
  it("updates the result", () => {
    fc.assert(
      fc.property(fc.string(), value => {
        expect(
          simplify(
            Form.text(x =>
              x.length % 2 === 0
                ? Result.Error(StructuredError.Failure("fail"))
                : Result.Ok("success"),
            )
              .load(value)
              .getResult(),
          ),
        ).toEqual(
          simplify(
            value.length % 2 === 0
              ? Result.Error(StructuredError.Failure("fail"))
              : Result.Ok("success"),
          ),
        );
      }),
    );
  });
});

describe("map", () => {
  it("transforms the result", () => {
    fc.assert(
      fc.property(arbitraryEither(arbitraryFormError, fc.anything()), result => {
        expect(
          simplify(
            Form.text(constant(result))
              .map(x => typeof x === "string")
              .getResult(),
          ),
        ).toEqual(simplify(result.map(x => typeof x === "string")));
      }),
    );
  });
});

describe("or", () => {
  it("picks the first successful form", () => {
    fc.assert(
      fc.property(
        arbitraryEither(arbitraryFormError, fc.anything()),
        arbitraryEither(arbitraryFormError, fc.anything()),
        arbitraryEither(arbitraryFormError, fc.anything()),
        (result1, result2, result3) => {
          expect(
            simplify(
              Form.text(constant(result1))
                .or(Form.text(constant(result2)))
                .or(Form.text(constant(result3)))
                .getResult(),
            ),
          ).toEqual(simplify(result1.or(result2).or(result3)));
        },
      ),
    );
  });
});

describe("queryError", () => {
  it("forwards to StructuredError.prototype.query", () => {
    fc.assert(
      fc.property(arbitraryFormError, error => {
        expect(
          simplify(
            Form.text(constant(Result.Error(error))).queryError(
              ...(error.data.tag === "Path" ? [error.data.value.key] : []),
            ),
          ),
        ).toEqual(
          simplify(error.query(...(error.data.tag === "Path" ? [error.data.value.key] : []))),
        );
      }),
    );
  });
});

describe("setValue", () => {
  it("Sets the dirty flag", () => {
    fc.assert(
      fc.property(fc.string(), value => {
        expect(Form.text(Result.Ok).setValue(value).dirty).toBeTruthy();
      }),
    );
  });
  it("Sets the value", () => {
    fc.assert(
      fc.property(fc.string(), value => {
        expect(Form.text(Result.Ok).setValue(value).value).toBe(value);
      }),
    );
  });
  it("Updates the result", () => {
    fc.assert(
      fc.property(fc.string(), value => {
        expect(
          Form.text(Result.Ok)
            .setValue(value)
            .getResult(),
        ).toEqual(Result.Ok(value));
      }),
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
            simplify(
              Form.record({
                foo: Form.text(Result.Ok),
                bar: Form.slider(Result.Ok),
                baz: Form.checkbox(Result.Ok),
              })
                .setValue(value)
                .getResult(),
            ),
          ).toEqual(simplify(Result.Ok(value)));
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
            simplify(
              Form.record({
                foo: Form.fail<string, string>("", StructuredError.Failure("Foo failed")),
                bar: Form.fail<number, number>(0, StructuredError.Failure("Bar failed")),
                baz: Form.fail<boolean, boolean>(false, StructuredError.Failure("Baz failed")),
              })
                .setValue(value)
                .getResult(),
            ),
          ).toEqual(
            simplify(
              Result.Error(
                StructuredError.Multiple([
                  StructuredError.Path("foo", StructuredError.Failure("Foo failed")),
                  StructuredError.Path("bar", StructuredError.Failure("Bar failed")),
                  StructuredError.Path("baz", StructuredError.Failure("Baz failed")),
                ]),
              ),
            ),
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
          simplify(
            Form.tuple(Form.text(Result.Ok), Form.slider(Result.Ok), Form.checkbox(Result.Ok))
              .setValue(value)
              .getResult(),
          ),
        ).toEqual(simplify(Result.Ok(value)));
      }),
    );
  });

  it("Constructs errors", () => {
    fc.assert(
      fc.property(fc.tuple(fc.string(), fc.integer(), fc.boolean()), value => {
        expect(
          simplify(
            Form.tuple(
              Form.fail<string, string>("", StructuredError.Failure("Foo failed")),
              Form.fail<number, number>(0, StructuredError.Failure("Bar failed")),
              Form.fail<boolean, boolean>(false, StructuredError.Failure("Baz failed")),
            )
              .setValue(value)
              .getResult(),
          ),
        ).toEqual(
          simplify(
            Result.Error(
              StructuredError.Multiple([
                StructuredError.Path(0, StructuredError.Failure("Foo failed")),
                StructuredError.Path(1, StructuredError.Failure("Bar failed")),
                StructuredError.Path(2, StructuredError.Failure("Baz failed")),
              ]),
            ),
          ),
        );
      }),
    );
  });
});

describe("setField", () => {
  it("Sets the fiel in an object", () => {
    fc.assert(
      fc.property(
        fc.record({
          foo: fc.string(),
          bar: fc.integer(),
          baz: fc.boolean(),
        }),
        fc.string(),
        (value, newFoo) => {
          expect(
            simplify(
              Form.setField(
                "foo",
                newFoo,
                Form.record({
                  foo: Form.text(Result.Ok),
                  bar: Form.slider(Result.Ok),
                  baz: Form.checkbox(Result.Ok),
                }).load(value),
              ).getResult(),
            ),
          ).toEqual(simplify(Result.Ok({ ...value, foo: newFoo })));
        },
      ),
    );
  });
});

describe("checkbox", () => {
  it("Validates booleans", () => {
    fc.assert(
      fc.property(fc.boolean(), value => {
        expect(
          Form.checkbox(x =>
            x ? Result.Ok(x) : Result.Error(StructuredError.Failure("Expected true")),
          )
            .setValue(value)
            .getResult(),
        ).toEqual(
          value ? Result.Ok(value) : Result.Error(StructuredError.Failure("Expected true")),
        );
      }),
    );
  });
});

describe("options", () => {
  it("Validates arrays", () => {
    fc.assert(
      fc.property(fc.array(fc.boolean()), values => {
        expect(
          Form.options<boolean, boolean>(x =>
            and(x) ? Result.Ok(and(x)) : Result.Error(StructuredError.Failure("Expected all true")),
          )
            .setValue(values)
            .getResult(),
        ).toEqual(
          and(values)
            ? Result.Ok(and(values))
            : Result.Error(StructuredError.Failure("Expected all true")),
        );
      }),
    );
  });
});

describe("select", () => {
  it("Validates maybes", () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constant(Maybe.Nothing<boolean>()), fc.boolean().map(Maybe.Just)),
        value => {
          expect(
            Form.select<boolean, boolean>(x =>
              Result.fromMaybe(x.filter(id), StructuredError.Failure("Expected Just true")),
            )
              .setValue(value)
              .getResult(),
          ).toEqual(
            Result.fromMaybe(value.filter(id), StructuredError.Failure("Expected Just true")),
          );
        },
      ),
    );
  });
});

describe("slider", () => {
  it("Validates numbers", () => {
    fc.assert(
      fc.property(fc.double(-1, 2), value => {
        expect(
          Form.slider(x =>
            x >= 0 && x <= 1
              ? Result.Ok(x)
              : Result.Error(StructuredError.Failure("Expected 0 ≤ x ≤ 1")),
          )
            .setValue(value)
            .getResult(),
        ).toEqual(
          value >= 0 && value <= 1
            ? Result.Ok(value)
            : Result.Error(StructuredError.Failure("Expected 0 ≤ x ≤ 1")),
        );
      }),
    );
  });
});

describe("text", () => {
  it("Validates strings", () => {
    fc.assert(
      fc.property(fc.string(), value => {
        expect(
          Form.text(x =>
            x.length === 0
              ? Result.Ok(x)
              : Result.Error(StructuredError.Failure("Expected non-empty")),
          )
            .setValue(value)
            .getResult(),
        ).toEqual(
          value.length === 0
            ? Result.Ok(value)
            : Result.Error(StructuredError.Failure("Expected non-empty")),
        );
      }),
    );
  });
});

const arbitraryFormError: fc.Arbitrary<FormError> = fc.oneof<FormError>(
  fc.string().map<FormError>(StructuredError.Failure),
  fc.array(fc.string().map<FormError>(StructuredError.Failure)).map(StructuredError.Multiple),
  fc.array(fc.string().map<FormError>(StructuredError.Failure)).map(StructuredError.Or),
  fc
    .tuple(
      fc.oneof<string | number>(fc.string(), fc.nat()),
      fc.string().map<FormError>(StructuredError.Failure),
    )
    .map(([path, error]) => StructuredError.Path(path, error)),
);
