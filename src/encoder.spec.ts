import * as fc from "fast-check";
import * as E from "./encoder";
import { Just, Maybe, Nothing } from "./maybe";
import { Case, id, prove } from "./prelude";
import { Equals } from "./utilityTypes";

/*------------------------------
  TYPE TESTS
  ------------------------------*/

// Map the fields of an object
prove<
  Equals<
    E.MapEncoder<any, { bar: number; baz: string }>,
    { bar: E.Encoder<any, number>; baz: E.Encoder<any, string> }
  >
>("proof");

// Map the items of an array
prove<Equals<E.MapEncoder<any, string[]>, Array<E.Encoder<any, string>>>>(
  "proof"
);

/*------------------------------
  UNIT TESTS
  ------------------------------*/

describe("build", () => {
  interface Foo {
    bar: number;
    baz: boolean;
    qux: string;
  }
  it("runs component encoders", () => {
    fc.assert(
      fc.property(
        fc.float(),
        fc.boolean(),
        fc.string(),
        (bar: number, baz: boolean, qux: string) => {
          expect(
            E.build<Foo>({
              bar: E.property("bar", E.number),
              baz: E.property("baz", E.boolean),
              qux: E.property("qux", E.string)
            }).encode({ bar, baz, qux })
          ).toEqual({ bar, baz, qux });
        }
      )
    );
  });
});

describe("boolean", () => {
  it("encodes booleans", () => {
    expect(E.boolean.encode(true)).toEqual(true);
    expect(E.boolean.encode(false)).toEqual(false);
  });
});

describe("$case", () => {
  it("Returns a predicate that requires the correct tag.", () => {
    const [p, _] = E.$case<
      string,
      { bar: string },
      Case<string> & { bar: string }
    >("Foo", E.build({ bar: E.property("bar", E.string) }));

    expect(p({ __case: "Foo", bar: "foo" })).toEqual(true);
    expect(p({ __case: "Qux", bar: "foo" })).toEqual(false);
  });

  it("Returns an encoder that encodes the object including the case.", () => {
    const [_, e] = E.$case<
      string,
      { bar: string },
      Case<string> & { bar: string }
    >("Foo", E.build({ bar: E.property("bar", E.string) }));

    expect(e.encode({ __case: "Foo", bar: "foo" })).toEqual({
      __case: "Foo",
      bar: "foo"
    });
  });
});

describe("oneOf", () => {
  it("Runs the first matching encoder.", () => {
    type Test = (Case<"Foo"> & { bar: string }) | Case<"Baz"> | Case<"Qux">;
    const encoder = E.oneOf<Test>(
      E.$case("Foo", E.build({ bar: E.property("bar", E.string) })),
      E.$case("Baz")
    );

    expect(encoder.encode({ __case: "Foo", bar: "bar" })).toEqual({
      __case: "Foo",
      bar: "bar"
    });
    expect(encoder.encode({ __case: "Baz" })).toEqual({ __case: "Baz" });
    expect(() => encoder.encode({ __case: "Qux" })).toThrow();
  });
});

describe("number", () => {
  it("encodes numbers", () => {
    fc.assert(
      fc.property(
        fc.anything().filter(x => typeof x === "number"),
        (input: any) => {
          expect(E.number.encode(input)).toEqual(input);
        }
      )
    );
  });
});

describe("string", () => {
  it("encodes strings", () => {
    fc.assert(
      fc.property(
        fc.anything().filter(x => typeof x === "string"),
        (input: any) => {
          expect(E.string.encode(input)).toEqual(input);
        }
      )
    );
  });
});

describe("array", () => {
  it("encodes arrays", () => {
    fc.assert(
      fc.property(fc.array(fc.anything()), input => {
        expect(E.array(E.makeEncoder(x => `${x}`)).encode(input)).toEqual(
          input.map(x => `${x}`)
        );
      })
    );
  });
});

describe("optional", () => {
  it("encodes Nothing as undefined", () => {
    expect(E.optional(E.number).encode(Nothing())).toBeUndefined();
  });
  it("encodes Just as value", () => {
    expect(E.optional(E.number).encode(Just(12))).toEqual(12);
  });
});

describe("property", () => {
  it("writes the value as an object property", () => {
    fc.assert(
      fc.property(fc.string(), fc.anything(), (key, input) => {
        expect(E.property(key, E.makeEncoder(id)).encode(input)).toEqual({
          [key]: input
        });
      })
    );
  });
});

describe("tuple", () => {
  it("encodes tuples", () => {
    fc.assert(
      fc.property(
        fc.tuple(fc.anything(), fc.anything(), fc.anything()),
        input => {
          expect(
            E.tuple(
              E.makeEncoder(id),
              E.makeEncoder(id),
              E.makeEncoder(id)
            ).encode(input)
          ).toEqual(input);
        }
      )
    );
  });
});

describe("Encoder", () => {
  describe("contramap", () => {
    it("transforms the input", () => {
      expect(E.number.contramap(Number.parseInt).encode("12")).toEqual(12);
    });
  });
});

describe("combinations", () => {
  const childDecoder = E.build<{ foo: string; bar: Maybe<number> }>({
    bar: E.property("bar", E.optional(E.number)),
    foo: E.property("foo", E.string)
  });
  const parentDecoder = E.build<{
    children: Array<{ foo: string; bar: Maybe<number> }>;
  }>({
    children: E.property("children", E.array(childDecoder))
  });
  it("composes results", () => {
    expect(
      parentDecoder.encode({
        children: [
          { foo: "baz", bar: Nothing() },
          { foo: "qux", bar: Just(24) }
        ]
      })
    ).toEqual({ children: [{ foo: "baz" }, { foo: "qux", bar: 24 }] });
  });
});
