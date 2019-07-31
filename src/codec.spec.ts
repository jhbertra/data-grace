import * as fc from "fast-check";
import * as C from "./codec";
import * as D from "./decoder";
import * as E from "./encoder";
import { Just, Maybe, Nothing, toMaybe } from "./maybe";
import { Equals, id, prove, simplify } from "./prelude";
import { Valid } from "./validation";

/*------------------------------
  TYPE TESTS
  ------------------------------*/

// Map the fields of an object
prove<Equals<
    C.MapCodec<any, { bar: number, baz: string }>,
    { bar: C.Codec<any, number>, baz: C.Codec<any, string> }>
>("proof");

// Map the items of an array
prove<Equals<C.MapCodec<any, string[]>, Array<C.Codec<any, string>>>>("proof");

/*------------------------------
  UNIT TESTS
  ------------------------------*/

describe("build", () => {
    interface IFoo {
        bar: number;
        baz: boolean;
        qux: string;
    }
    const codec = C.build<IFoo>({
        bar: C.property("bar", C.number),
        baz: C.property("baz", C.boolean),
        qux: C.property("qux", C.string),
    });
    const decoder = D.build<IFoo>({
        bar: D.property("bar", D.number),
        baz: D.property("baz", D.boolean),
        qux: D.property("qux", D.string),
    });
    const encoder = E.build<IFoo>({
        bar: E.property("bar", E.number),
        baz: E.property("baz", E.boolean),
        qux: E.property("qux", E.string),
    });
    it("encode equals encoder", () => {
        fc.assert(
            fc.property(
                fc.float(),
                fc.boolean(),
                fc.string(),
                (bar, baz, qux) => {
                    const input = { bar, baz, qux };
                    expect(codec.encode(input)).toEqual(encoder.encode(input));
                }));
    });
    it("decode equals decoder", () => {
        fc.assert(
            fc.property(
                fc.anything(),
                fc.anything(),
                fc.anything(),
                (bar, baz, qux) => {
                    const input = { bar, baz, qux };
                    expect(simplify(codec.decode(input))).toEqual(simplify(decoder.decode(input)));
                }));
    });
    it("preserves input for decode -> encode", () => {
        fc.assert(
            fc.property(
                fc.float(),
                fc.boolean(),
                fc.string(),
                (bar, baz, qux) => {
                    const input = { bar, baz, qux };
                    expect(simplify(codec.decode(input).map(codec.encode))).toEqual(simplify(Valid(input)));
                }));
    });
    it("preserves input for encode -> decode", () => {
        fc.assert(
            fc.property(
                fc.float(),
                fc.boolean(),
                fc.string(),
                (bar, baz, qux) => {
                    const input = { bar, baz, qux };
                    expect(simplify(codec.decode(codec.encode(input)))).toEqual(simplify(Valid(input)));
                }));
    });
});

describe("date", () => {
    it("encode equals encoder", () => {
        const date = new Date();
        expect(C.date.encode(date)).toEqual(E.date.encode(date));
    });
    it("decode equals decoder", () => {
        fc.assert(
            fc.property(
                fc.anything(),
                (input) => { expect(simplify(C.date.decode(input))).toEqual(simplify(D.date.decode(input))); }));
    });
});

describe("boolean", () => {
    it("encode equals encoder", () => {
        expect(C.boolean.encode(true)).toEqual(E.boolean.encode(true));
        expect(C.boolean.encode(false)).toEqual(E.boolean.encode(false));
    });
    it("decode equals decoder", () => {
        fc.assert(
            fc.property(
                fc.anything(),
                (input) => { expect(simplify(C.boolean.decode(input))).toEqual(simplify(D.boolean.decode(input))); }));
    });
});

describe("number", () => {
    it("encode equals encoder", () => {
        fc.assert(
            fc.property(
                fc.integer(),
                (input) => { expect(C.number.encode(input)).toEqual(E.number.encode(input)); }));
    });
    it("decode equals decoder", () => {
        fc.assert(
            fc.property(
                fc.anything(),
                (input) => { expect(simplify(C.number.decode(input))).toEqual(simplify(D.number.decode(input))); }));
    });
});

describe("string", () => {
    it("encode equals encoder", () => {
        fc.assert(
            fc.property(
                fc.string(),
                (input) => { expect(C.string.encode(input)).toEqual(E.string.encode(input)); }));
    });
    it("decode equals decoder", () => {
        fc.assert(
            fc.property(
                fc.anything(),
                (input) => { expect(simplify(C.string.decode(input))).toEqual(simplify(D.string.decode(input))); }));
    });
});

describe("array", () => {
    it("encode equals encoder", () => {
        fc.assert(
            fc.property(
                fc.array(fc.string()),
                (input) => { expect(C.array(C.string).encode(input)).toEqual(E.array(E.string).encode(input)); }));
    });
    it("decode equals decoder", () => {
        fc.assert(
            fc.property(
                fc.anything(),
                (input) => {
                    expect(simplify(C.array(C.string).decode(input)))
                    .toEqual(simplify(D.array(D.string).decode(input)));
                }));
    });
});

describe("optional", () => {
    it("encode equals encoder", () => {
        fc.assert(
            fc.property(
                fc.oneof(fc.string(), fc.constant(undefined)).map(toMaybe),
                (input) => {
                    expect(C.optional(C.string).encode(input))
                    .toEqual(E.optional(E.string).encode(input));
                }));
    });
    it("decode equals decoder", () => {
        fc.assert(
            fc.property(
                fc.anything(),
                (input) => {
                    expect(simplify(C.optional(C.string).decode(input)))
                    .toEqual(simplify(D.optional(D.string).decode(input)));
                }));
    });
});

describe("property", () => {
    it("encode equals encoder", () => {
        fc.assert(
            fc.property(
                fc.string(),
                fc.string(),
                (key, input) => {
                    expect(C.property(key, C.string).encode(input))
                        .toEqual(E.property(key, E.string).encode(input));
                }));
    });
    it("decode equals decoder", () => {
        fc.assert(
            fc.property(
                fc.string(),
                fc.object(),
                (key, input) => {
                    expect(simplify(C.property(key, C.string).decode(input)))
                        .toEqual(simplify(D.property(key, D.string).decode(input)));
                }));
    });
});

describe("tuple", () => {
    it("encode equals encoder", () => {
        fc.assert(
            fc.property(
                fc.tuple(fc.string(), fc.boolean(), fc.integer()),
                (input) => {
                    expect(C.tuple(C.string, C.boolean, C.number).encode(input))
                        .toEqual(E.tuple(E.string, E.boolean, E.number).encode(input));
                }));
    });
    it("decode equals decoder", () => {
        fc.assert(
            fc.property(
                fc.tuple(fc.anything(), fc.anything(), fc.anything()),
                (input) => {
                    expect(simplify(C.tuple(C.string, C.boolean, C.number).decode(input)))
                        .toEqual(simplify(D.tuple(D.string, D.boolean, D.number).decode(input)));
                }));
    });
});

describe("ICodec", () => {
    describe("invmap", () => {
        it("transforms the input and output", () => {
            const codec = C.number.invmap((x) => x.toString(), Number.parseInt);
            expect(codec.encode("12")).toEqual(12);
            expect(simplify(codec.decode(12))).toEqual(simplify(Valid("12")));
        });
    });
});
