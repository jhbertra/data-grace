import * as fc from "fast-check";
import { unzip } from "./array";
import * as D from "./decoder";
import { Just, Maybe, Nothing } from "./maybe";
import { objectFromEntries, prove, simplify } from "./prelude";
import { Equals } from "./utilityTypes";
import { Invalid, Valid } from "./validation";

/*------------------------------
  TYPE TESTS
  ------------------------------*/

// Map the fields of an object
prove<Equals<
    D.MapDecoder<any, { bar: number, baz: string }>,
    { bar: D.IDecoder<any, number>, baz: D.IDecoder<any, string> }>
>("proof");

// Map the items of an array
prove<Equals<D.MapDecoder<any, string[]>, Array<D.IDecoder<any, string>>>>("proof");

/*------------------------------
  UNIT TESTS
  ------------------------------*/

describe("build", () => {
    interface IFoo {
        bar: number;
        baz: boolean;
        qux: string;
    }

    it("equals construct + wrap when all components have value", () => {
        fc.assert(
            fc.property(
                fc.float(),
                fc.boolean(),
                fc.string(),
                (bar: number, baz: boolean, qux: string) => {
                    expect(
                        simplify(D
                            .build<IFoo>({
                                bar: D.constant(bar),
                                baz: D.constant(baz),
                                qux: D.constant(qux),
                            })
                            .decode({})))
                        .toEqual(simplify(Valid({
                            bar,
                            baz,
                            qux,
                        })));
                }));
    });
    it("equals Invalid when any components have no value", () => {
        fc.assert(
            fc.property(
                fc.float(),
                fc.boolean(),
                fc.string(),
                fc.array(fc.oneof(fc.constant("bar"), fc.constant("baz"), fc.constant("qux")), 1, 3),
                (bar: number, baz: boolean, qux: string, empties: string[]) => {
                    function getComponent<T>(prop: string, value: T): D.IDecoder<object, T> {
                        return empties.find((x) => x === prop) != null
                            ? D.constantFailure({ [prop]: "error" })
                            : D.constant(value);
                    }
                    expect(
                        simplify(D
                            .build<IFoo>({
                                bar: getComponent("bar", bar),
                                baz: getComponent("baz", baz),
                                qux: getComponent("qux", qux),
                            })
                            .decode({})))
                        .toEqual(simplify(
                            Invalid(empties
                                .sort()
                                .reduce((state, prop) => ({ ...state, [prop]: "error" }), {}))));
                }));
        });
    it("rejects non-objects", () => {
        fc.assert(
            fc.property(
                fc.anything().filter((x) => x == null || typeof(x) !== "object"),
                (input) => {
                    expect(
                        simplify(D
                            .build<IFoo>({
                                bar: D.constant(1),
                                baz: D.constant(true),
                                qux: D.constant("qux"),
                            })
                            .decode(input)))
                        .toEqual(simplify(Invalid({ $: "Expected an object" })));
                }));
        });
});

describe("mapM and forM", () => {
    it("is equal to map + wrap for only Valid results", () => {
        fc.assert(
            fc.property(
                fc.array(fc.integer()),
                (xs: number[]) => {
                    const resultForM = simplify(D.forM(xs, (x) => D.constant(x.toString())).decode(null));
                    const resultMapM = simplify(D.mapM((x) => D.constant(x.toString()), xs).decode(null));
                    expect(resultForM).toEqual(resultMapM);
                    expect(resultMapM).toEqual(simplify(Valid(xs.map((x) => x.toString()))));
                }));
    });
    it("is equal to nothing for any Invalid results", () => {
        fc.assert(
            fc.property(
                fc
                    .integer(1, 10)
                    .chain((size) => fc
                        .array(fc.integer(0, size - 1), 1, size)
                        .map(((empties) => [size, empties] as [number, number[]]))),
                ([size, empties]) => {
                    const input = [];

                    for (let i = 0; i < size; i++) {
                        input.push(i);
                    }

                    const mapping = (i: number) => empties.find((x) => x === i) != null
                        ? D.constantFailure({ [i]: "error" })
                        : D.constant(i.toString());

                    const resultForM = simplify(D.forM(input, mapping).decode(null));
                    const resultMapM = simplify(D.mapM(mapping, input).decode(null));
                    expect(resultForM).toEqual(resultMapM);
                    expect(resultMapM)
                        .toEqual(simplify(
                            Invalid(empties.sort().reduce((state, x) => ({ ...state, [x]: "error" }), {}))));
                }));
    });
});

describe("lift", () => {
    const f = (a: number, b: boolean, c: string) => `${a} ${b} ${c}`;
    it("equals apply + wrap when all arguments have value", () => {
        fc.assert(
            fc.property(
                fc.float(),
                fc.boolean(),
                fc.string(),
                (a: number, b: boolean, c: string) => {
                    expect(simplify(D.lift(f, D.constant(a), D.constant(b), D.constant(c)).decode(null)))
                        .toEqual(simplify(Valid(f(a, b, c))));
                }));
    });
    it("equals Invalid when any arguments have no value", () => {
        fc.assert(
            fc.property(
                fc.float(),
                fc.boolean(),
                fc.string(),
                fc.array(fc.integer(0, 2), 1, 3),
                (a: number, b: boolean, c: string, empties: number[]) => {
                    function getArg<T>(i: number, value: T): D.IDecoder<any, T> {
                        return empties.find((x) => x === i) != null
                            ? D.constantFailure({ [i]: "error" })
                            : D.constant(value);
                    }

                    expect(
                        simplify(D
                            .lift(f, getArg(0, a), getArg(1, b), getArg(2, c))
                            .decode(null)))
                        .toEqual(simplify(
                            Invalid(empties.sort().reduce((state, x) => ({ ...state, [x]: "error" }), {}))));
                }));
    });
});

describe("mapAndUnzipWith", () => {
    it("is equal to map + unzip + wrap for only Valid results", () => {
        fc.assert(
            fc.property(
                fc.array(fc.tuple(fc.integer(), fc.string())),
                (xys: Array<[number, string]>) => {
                    expect(
                        simplify(
                            D.mapAndUnzipWith(([x, y]) => D.constant<[string, number]>([y, x]), xys).decode(null)))
                        .toEqual(simplify(Valid(unzip(xys.map(([x, y]) => [y, x] as [string, number])))));
                }));
    });
    it("is equal to Invalid for any Invalid results", () => {
        fc.assert(
            fc.property(
                fc
                    .array(fc.tuple(fc.integer(), fc.string()), 1, 10)
                    .chain((xys) => fc
                        .array(fc.integer(0, xys.length - 1), 1, xys.length)
                        .map(((empties) => [xys, empties] as [Array<[number, string]>, number[]]))),
                ([xys, empties]) => {
                    expect(simplify(
                        D
                            .mapAndUnzipWith(
                                ([[x, y], i]) => empties.find((e) => e === i) != null
                                    ? D.constantFailure<[string, number]>({ [i]: "error" })
                                    : D.constant<[string, number]>([y, x]),
                                xys.map((xy, i) => [xy, i] as [[number, string], number]))
                            .decode(null)))
                        .toEqual(simplify(
                            Invalid(empties.sort().reduce((state, x) => ({ ...state, [x]: "error" }), {}))));
                }));
    });
});

describe("sequence", () => {
    it("is equal to wrap for only Valid results", () => {
        fc.assert(
            fc.property(
                fc.array(fc.string()),
                (strs: string[]) => {
                    expect(simplify(D.sequence(strs.map(D.constant)).decode(null))).toEqual(simplify(Valid(strs)));
                }));
    });
    it("is equal to Invalid for any Invalid results", () => {
        fc.assert(
            fc.property(
                fc
                    .array(fc.string(), 1, 10)
                    .chain((strs) => fc
                        .array(fc.integer(0, strs.length - 1), 1, strs.length)
                        .map((empties) =>
                            [strs.map((s, i) => [s, i]), empties] as [Array<[string, number]>, number[]])),
                ([strs, empties]) => {
                    const predicate = ([s, i]: [string, number]) => empties.find((x) => x === i) == null;
                    expect(simplify(
                        D
                            .sequence(
                                strs.map((str) => predicate(str)
                                    ? D.constant(str[0])
                                    : D.constantFailure({ [str[1]]: "error" })))
                            .decode(null)))
                        .toEqual(simplify(
                            Invalid(empties.sort().reduce((state, x) => ({ ...state, [x]: "error" }), {}))));
                }));
    });
});

describe("zipWithM", () => {
    it("is equal to zipWith + wrap for only Valid results", () => {
        fc.assert(
            fc.property(
                fc.array(fc.string()),
                fc.array(fc.integer()),
                (strs: string[], ns: number[]) => {
                    expect(simplify(D.zipWithM((str, n) => D.constant(str.length + n), strs, ns).decode(null)))
                        .toEqual(simplify(Valid(strs.zipWith((str, n) => str.length + n, ns))));
                }));
    });
    it("is equal to Invalid for any Invalid results", () => {
        const arb = fc
            .array(fc.string(), 1, 10)
            .chain((strs) => fc
                .array(fc.integer(), 1, 10)
                .map((ns) => [strs.map((s, i) => [s, i]), ns] as [Array<[string, number]>, number[]]))
            .chain(([strs, ns]) => {
                const size = Math.min(strs.length, ns.length);
                return fc
                    .array(fc.integer(0, size - 1), 1, size)
                    .map((empties) => [strs, ns, empties] as [Array<[string, number]>, number[], number[]]);
            });

        fc.assert(
            fc.property(
                arb,
                ([strs, ns, empties]) => {
                    const predicate = (i: number) => empties.find((x) => x === i) == null;
                    expect(simplify(
                        D
                            .zipWithM(
                                ([str, i], n) => predicate(i)
                                    ? D.constant(str.length + n)
                                    : D.constantFailure({ [i]: "error" }),
                                strs,
                                ns)
                            .decode(null)))
                        .toEqual(simplify(
                            Invalid(empties.sort().reduce((state, x) => ({ ...state, [x]: "error" }), {}))));
                }));
    });
});

describe("boolean", () => {
    it("decodes booleans", () => {
        expect(simplify(D.boolean.decode(true))).toEqual(simplify(Valid(true)));
        expect(simplify(D.boolean.decode(false))).toEqual(simplify(Valid(false)));
    });
    it("fails invalid input", () => {
        fc.assert(
            fc.property(
                fc.anything().filter((x) => typeof (x) !== "boolean"),
                (input: any) => {
                    expect(simplify(D.boolean.decode(input)))
                        .toEqual(simplify(Invalid({ $: "Expected a boolean" })));
                }));
    });
});

describe("number", () => {
    it("decodes numbers", () => {
        fc.assert(
            fc.property(
                fc.anything().filter((x) => typeof (x) === "number"),
                (input: any) => {
                    expect(simplify(D.number.decode(input))).toEqual(simplify(Valid(input)));
                }));
    });
    it("fails invalid input", () => {
        fc.assert(
            fc.property(
                fc.anything().filter((x) => typeof (x) !== "number"),
                (input: any) => {
                    expect(simplify(D.number.decode(input)))
                        .toEqual(simplify(Invalid({ $: "Expected a number" })));
                }));
    });
});

describe("string", () => {
    it("decodes strings", () => {
        fc.assert(
            fc.property(
                fc.anything().filter((x) => typeof (x) === "string"),
                (input: any) => {
                    expect(simplify(D.string.decode(input))).toEqual(simplify(Valid(input)));
                }));
    });
    it("fails invalid input", () => {
        fc.assert(
            fc.property(
                fc.anything().filter((x) => typeof (x) !== "string"),
                (input: any) => {
                    expect(simplify(D.string.decode(input)))
                        .toEqual(simplify(Invalid({ $: "Expected a string" })));
                }));
    });
});

describe("array", () => {
    it("decodes arrays when decoder succeeds", () => {
        fc.assert(
            fc.property(
                fc.array(fc.anything()),
                (input) => {
                    expect(simplify(D.array(D.id).decode(input))).toEqual(simplify(Valid(input)));
                }));
    });
    it("fails to decode arrays when decoder fails", () => {
        fc.assert(
            fc.property(
                fc.array(fc.anything(), 1, 10),
                (input) => {
                    expect(simplify(D.array(D.constantFailure({ $: "error" })).decode(input)))
                        .toEqual(simplify(Invalid(objectFromEntries(input.map((_: any, i) => [`[${i}]`, "error"])))));
                }));
    });
    it("fails invalid input", () => {
        fc.assert(
            fc.property(
                fc.anything().filter((x) => !Array.isArray(x)),
                (input: any) => {
                    expect(simplify(D.array(D.id).decode(input)))
                        .toEqual(simplify(Invalid({ $: "Expected an array" })));
                }));
    });
});

describe("oneOf", () => {
    it("decodes allowed items", () => {
        fc.assert(
            fc.property(
                fc.oneof<string | number | boolean>(fc.constant("foo"), fc.integer(), fc.boolean()),
                (input) => {
                    expect(
                        simplify(D
                            .oneOf<string | number | boolean>(D.only("foo"), D.number, D.boolean)
                            .decode(input)))
                        .toEqual(simplify(Valid(input)));
                }));
    });
    it("fails to decode forbidden items", () => {
        fc.assert(
            fc.property(
                fc.anything().filter((x) => x !== "foo" && typeof(x) !== "number" && typeof(x) !== "boolean"),
                (input) => {
                    expect(
                        simplify(D
                            .oneOf<string | number | boolean>(D.only("foo"), D.number, D.boolean)
                            .decode(input)))
                        .toEqual(simplify(Invalid({ $: "Expected a boolean" })));
                }));
    });
});

describe("optional", () => {
    it("decodes null", () => {
        expect(simplify(D.optional(D.constantFailure({ $: "Fail" })).decode(null)))
            .toEqual(simplify(Valid(Nothing())));
    });
    it("decodes undefined", () => {
        expect(simplify(D.optional(D.constantFailure({ $: "Fail" })).decode(undefined)))
            .toEqual(simplify(Valid(Nothing())));
    });
    it("fails if decoder fails", () => {
        fc.assert(
            fc.property(
                fc.anything().filter((x) => x != null),
                (input: any) => {
                    expect(simplify(D.optional(D.constantFailure({ $: "Fail" })).decode(input)))
                        .toEqual(simplify(Invalid({ $: "Fail" })));
                }));
    });
    it("succeeds if decoder succeeds", () => {
        fc.assert(
            fc.property(
                fc.anything().filter((x) => x != null),
                (input: any) => {
                    expect(simplify(D.optional(D.id).decode(input)))
                        .toEqual(simplify(Valid(Just(input))));
                }));
    });
});

describe("property", () => {
    it("fails if decoder fails", () => {
        fc.assert(
            fc.property(
                fc.object({ key: fc.constant("foo") }).filter((x) => Object.keys(x).length > 0),
                (input) => {
                    expect(simplify(D.property("foo", D.constantFailure({ $: "Fail" }) as any).decode(input)))
                        .toEqual(simplify(Invalid({ foo: "Fail" })));
                }));
    });
    it("succeeds if decoder succeeds", () => {
        fc.assert(
            fc.property(
                fc.object({ key: fc.constant("foo") }).filter((x) => Object.keys(x).length > 0),
                (input) => {
                    expect(simplify(D.property("foo", D.id).decode(input)))
                        .toEqual(simplify(Valid(input.foo)));
                }));
    });
    it("fails if property not found and property is required", () => {
        fc.assert(
            fc.property(
                fc.object().filter((x) => !x.hasOwnProperty("foo")),
                (input) => {
                    expect(simplify(D.property("foo", D.string).decode(input)))
                        .toEqual(simplify(Invalid({ foo: "Expected a string" })));
                }));
    });
    it("fails if property not found and property is optional", () => {
        fc.assert(
            fc.property(
                fc.object().filter((x) => !x.hasOwnProperty("foo")),
                (input) => {
                    expect(simplify(D.property("foo", D.optional(D.string)).decode(input)))
                        .toEqual(simplify(Valid(Nothing())));
                }));
    });
});

describe("tuple", () => {
    it("decodes tuples when decoders succeed", () => {
        fc.assert(
            fc.property(
                fc.tuple(fc.anything(), fc.anything(), fc.anything()),
                (input) => {
                    expect(simplify(D.tuple(D.id, D.id, D.id).decode(input))).toEqual(simplify(Valid(input)));
                }));
    });
    it("fails to decode tuples when decoders fail", () => {
        fc.assert(
            fc.property(
                fc.tuple(fc.anything(), fc.anything(), fc.anything()),
                (input) => {
                    expect(
                        simplify(D
                            .tuple(
                                D.constantFailure({ $: "error1" }),
                                D.constantFailure({ $: "error2" }),
                                D.constantFailure({ $: "error3" }))
                            .decode(input)))
                        .toEqual(simplify(Invalid({ "[0]": "error1", "[1]": "error2", "[2]": "error3" })));
                }));
    });
    it("fails invalid input", () => {
        fc.assert(
            fc.property(
                fc.anything().filter((x) => !Array.isArray(x) || x.length !== 3),
                (input) => {
                    expect(simplify(D.tuple(D.id, D.id, D.id).decode(input)))
                        .toEqual(simplify(Invalid({ $: "Expected an array of length 3" })));
                }));
    });
});

describe("IDecoder", () => {

    describe("map", () => {
        it("Passes the payload to the callback", () => {
            fc.assert(fc.property(fc.string(), (s) => {
                D.constant(s).map((x) => expect(x).toEqual(s)).decode(null);
            }));
        });
        it("Wraps the value returned by the callback", () => {
            const k = (s: string) => s.length;
            fc.assert(fc.property(fc.string(), (s) => {
                expect(simplify(D.constant(s).map(k).decode(null))).toEqual(simplify(Valid(k(s))));
            }));
        });
        it("Skips the callback on empty", () => {
            const k = (s: string) => s.length;
            expect(simplify(D.constantFailure<string>({ key: "error" }).map(k).decode(null)))
                .toEqual(simplify(
                    Invalid({ key: "error" })));
        });
    });

    describe("or", () => {
        it("Picks the first if Valid", () => {
            expect(simplify(D.constant("foo").or(D.constant("bar")).decode(null))).toEqual(simplify(Valid("foo")));
        });
        it("Picks the second if first Invalid", () => {
            expect(simplify(D.constantFailure({ key: "error" }).or(D.constant("bar")).decode(null)))
                .toEqual(simplify(Valid("bar")));
        });
        it("Picks the second if both Invalid", () => {
            expect(simplify(D.constantFailure({ key1: "error" }).or(D.constantFailure({ key2: "error" })).decode(null)))
                .toEqual(simplify(
                    Invalid({ key2: "error" })));
        });
    });

    describe("replace", () => {
        it("Returns something if both are Valid", () => {
            expect(simplify(D.constant("foo").replace(D.constant("bar")).decode(null))).toEqual(simplify(Valid("bar")));
        });
        it("Returns Invalid if the second is Invalid", () => {
            expect(simplify(D.constant("foo").replace(D.constantFailure({ key: "error" })).decode(null)))
                .toEqual(simplify(
                    Invalid({ key: "error" })));
        });
        it("Returns Invalid if the first is Invalid", () => {
            expect(simplify(D.constantFailure({ key: "error" }).replace(D.constant("bar")).decode(null)))
                .toEqual(simplify(
                    Invalid({ key: "error" })));
        });
        it("Returns Invalid if both are Invalid", () => {
            expect(
                simplify(D
                    .constantFailure({ key1: "error" })
                    .replace(D.constantFailure({ key2: "error" }))
                    .decode(null)))
                .toEqual(simplify(
                    Invalid({ key1: "error", key2: "error" })));
        });
    });

    describe("replacePure", () => {
        it("Replaces value if Valid", () => {
            expect(simplify(D.constant("foo").replacePure(2).decode(null))).toEqual(simplify(Valid(2)));
        });
        it("Returns Invalid if Invalid", () => {
            expect(simplify(D.constantFailure({ key: "error" }).replacePure(2).decode(null)))
                .toEqual(simplify(
                    Invalid({ key: "error" })));
        });
    });

    describe("voidOut", () => {
        it("Returns Invalid (s) for Invalid (s)", () => {
            expect(simplify(D.constantFailure({ key: "error" }).voidOut().decode(null)))
                .toEqual(simplify(
                    Invalid({ key: "error" })));
        });
        it("Returns Valid ([]) for Valid (s)", () => {
            expect(simplify(D.constant("foo").voidOut().decode(null))).toEqual(simplify(Valid([])));
        });
    });
});

describe("combinations", () => {
    const childDecoder = D.build<{ foo: string, bar: Maybe<number> }>({
        bar: D.property("bar", D.optional(D.number)),
        foo: D.property("foo", D.string),
    });
    const parentDecoder = D.build<{ children: Array<{ foo: string, bar: Maybe<number> }> }>({
        children: D.property("children", D.array(childDecoder)),
    });
    it("composes results", () => {
        expect(simplify(parentDecoder.decode({ children: [{foo: "baz"}, {foo: "qux", bar: 24}] })))
            .toEqual(simplify(Valid(
                { children: [{foo: "baz", bar: Nothing() }, {foo: "qux", bar: Just(24) }] },
            )));
    });
    it("composes errors", () => {
        expect(simplify(parentDecoder.decode({ children: [{foo: true}, {bar: false}] })))
            .toEqual(simplify(Invalid({
                "children[0].foo": "Expected a string",
                "children[1].bar": "Expected a number",
                "children[1].foo": "Expected a string",
            })));
    });
});
