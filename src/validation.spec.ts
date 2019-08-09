import * as fc from "fast-check";
import { unzip } from "./array";
import { Left, Right } from "./either";
import { Just, Nothing } from "./maybe";
import { prove, simplify } from "./prelude";
import { Equals } from "./utilityTypes";
import * as V from "./validation";

/*------------------------------
  TYPE TESTS
  ------------------------------*/

// Map the fields of an object
prove<Equals<
    V.MapValidation<[string], { bar: number, baz: string }>,
    { bar: V.Validation<[string], number>, baz: V.Validation<[string], string> }>
>("proof");

// Map the items of an array
prove<Equals<V.MapValidation<[string], string[]>, Array<V.Validation<[string], string>>>>("proof");

/*------------------------------
  UNIT TESTS
  ------------------------------*/

describe("arrayToValidation", () => {
    it("returns an error when input is empty", () => {
        expect(simplify(V.arrayToValidation([], ["error"]))).toEqual(simplify(V.Invalid(["error"])));
    });
    it("returns the first element when the input is not empty", () => {
        fc.assert(
            fc.property(
                fc.array(fc.integer()).filter((x) => x.length > 0),
                (xs: number[]) => {
                    expect(simplify(V.arrayToValidation(xs, ["error"]))).toEqual(simplify(V.Valid(xs[0])));
                }));
    });
});

describe("maybeToValidation", () => {
    it("returns an error when input is empty", () => {
        expect(simplify(V.maybeToValidation(Nothing(), ["error"]))).toEqual(simplify(V.Invalid(["error"])));
    });
    it("returns the value when the input is not empty", () => {
        fc.assert(
            fc.property(
                fc.anything(),
                (a) => {
                    expect(simplify(V.maybeToValidation(Just(a), ["error"]))).toEqual(simplify(V.Valid(a)));
                }));
    });
});

describe("eitherToValidation", () => {
    it("maps Left -> Invalid", () => {
        fc.assert(
            fc.property(
                fc.oneof(fc.array(fc.anything()), fc.object()),
                (e) => {
                    expect(simplify(V.eitherToValidation(Left(e)))).toEqual(simplify(V.Invalid(e)));
                }));
    });
    it("returns the value when the input is not empty", () => {
        fc.assert(
            fc.property(
                fc.anything(),
                (a) => {
                    expect(simplify(V.eitherToValidation(Right<any[], any>(a)))).toEqual(simplify(V.Valid(a)));
                }));
    });
});

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
                    expect(simplify(V.build<[string], IFoo>({
                        bar: V.Valid(bar),
                        baz: V.Valid(baz),
                        qux: V.Valid(qux),
                    }))).toEqual(simplify(V.Valid({
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
                    function getComponent<T>(prop: string, value: T): V.Validation<object, T> {
                        return empties.find((x) => x === prop) != null
                            ? V.Invalid({ [prop]: "error" })
                            : V.Valid(value);
                    }
                    expect(simplify(V.build<object, IFoo>({
                        bar: getComponent("bar", bar),
                        baz: getComponent("baz", baz),
                        qux: getComponent("qux", qux),
                    }))).toEqual(simplify(V.Invalid(empties
                        .sort()
                        .reduce((state, prop) => ({ ...state, [prop]: "error" }), {}))));
                }));
    });
});

describe("failures", () => {
    it("returns the value of every Invalid", () => {
        fc.assert(
            fc.property(
                fc.array(fc.oneof(
                    fc.string().map((x) => V.Invalid<[string], number>([x])),
                    fc.integer().map((x) => V.Valid<[string], number>(x)))),
                (xs: Array<V.Validation<[string], number>>) => {
                    expect(V.failures(xs)).toEqual(xs.filter((x) => x.isInvalid()).map((x) => (x as any).failure));
                }));
    });
});

describe("successful", () => {
    it("returns the value of every Invalid", () => {
        fc.assert(
            fc.property(
                fc.array(fc.oneof(
                    fc.string().map((x) => V.Invalid<[string], number>([x])),
                    fc.integer().map((x) => V.Valid<[string], number>(x)))),
                (xs: Array<V.Validation<[string], number>>) => {
                    expect(V.successful(xs)).toEqual(xs.filter((x) => x.isValid()).map((x) => (x as any).value));
                }));
    });
});

describe("mapM and forM", () => {
    it("is equal to map + wrap for only Valid results", () => {
        fc.assert(
            fc.property(
                fc.array(fc.integer()),
                (xs: number[]) => {
                    const resultForM = simplify(V.forM(xs, (x) => V.Valid(x.toString())));
                    const resultMapM = simplify(V.mapM((x) => V.Valid(x.toString()), xs));
                    expect(resultForM).toEqual(resultMapM);
                    expect(resultMapM).toEqual(simplify(V.Valid(xs.map((x) => x.toString()))));
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
                        ? V.Invalid([i])
                        : V.Valid(i.toString());

                    const resultForM = simplify(V.forM(input, mapping));
                    const resultMapM = simplify(V.mapM(mapping, input));
                    expect(resultForM).toEqual(resultMapM);
                    expect(resultMapM)
                        .toEqual(simplify(V.Invalid(empties.sort().filter((x, i, arr) => arr.indexOf(x) === i))));
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
                    expect(simplify(V.lift(f, V.Valid(a), V.Valid(b), V.Valid(c))))
                        .toEqual(simplify(V.Valid(f(a, b, c))));
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
                    function getArg<T>(i: number, value: T): V.Validation<[number], T> {
                        return empties.find((x) => x === i) != null
                            ? V.Invalid([i])
                            : V.Valid(value);
                    }

                    expect(simplify(V.lift(f, getArg(0, a), getArg(1, b), getArg(2, c))))
                        .toEqual(simplify(V.Invalid(empties.sort().filter((x, i, arr) => arr.indexOf(x) === i))));
                }));
    });
});

describe("mapAndUnzipWith", () => {
    it("is equal to map + unzip + wrap for only Valid results", () => {
        fc.assert(
            fc.property(
                fc.array(fc.tuple(fc.integer(), fc.string())),
                (xys: Array<[number, string]>) => {
                    expect(simplify(V.mapAndUnzipWith(([x, y]) => V.Valid([y, x] as [string, number]), xys)))
                        .toEqual(simplify(V.Valid(unzip(xys.map(([x, y]) => [y, x] as [string, number])))));
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
                        V.mapAndUnzipWith(
                            ([[x, y], i]) => empties.find((e) => e === i) != null
                                ? V.Invalid<number[], [string, number]>([i])
                                : V.Valid([y, x] as [string, number]),
                            xys.map((xy, i) => [xy, i] as [[number, string], number]))))
                        .toEqual(simplify(V.Invalid(empties.sort().filter((x, i, arr) => arr.indexOf(x) === i))));
                }));
    });
});

describe("sequence", () => {
    it("is equal to wrap for only Valid results", () => {
        fc.assert(
            fc.property(
                fc.array(fc.string()),
                (strs: string[]) => {
                    expect(simplify(V.sequence(strs.map(V.Valid)))).toEqual(simplify(V.Valid(strs)));
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
                        V.sequence(
                            strs.map((str) => predicate(str) ? V.Valid(str[0]) : V.Invalid([str[1]])))))
                        .toEqual(simplify(V.Invalid(empties.sort().filter((x, i, arr) => arr.indexOf(x) === i))));
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
                    expect(simplify(V.zipWithM((str, n) => V.Valid(str.length + n), strs, ns)))
                        .toEqual(simplify(V.Valid(strs.zipWith((str, n) => str.length + n, ns))));
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
                        V.zipWithM(
                            ([str, i], n) => predicate(i) ? V.Valid(str.length + n) : V.Invalid([i]),
                            strs,
                            ns)))
                        .toEqual(simplify(V.Invalid(empties.sort().filter((x, i, arr) => arr.indexOf(x) === i))));
                }));
    });
});

describe("IValidation", () => {

    describe("defaultWith", () => {
        it("Returns default when Invalid", () => {
            fc.assert(fc.property(fc.string(), (s) => { expect(V.Invalid([s]).defaultWith("foo")).toEqual("foo"); }));
        });
        it("Returns payload when Valid", () => {
            fc.assert(fc.property(fc.string(), (s) => { expect(V.Valid(s).defaultWith("foo")).toEqual(s); }));
        });
    });

    describe("isValid", () => {
        it("Returns true for Valid(s)", () => {
            fc.assert(fc.property(fc.string(), (s) => {
                expect(simplify(V.Valid(s).isValid())).toEqual(true);
            }));
        });
        it("Returns false for Invalid(s)", () => {
            fc.assert(fc.property(fc.string(), (s) => {
                expect(simplify(V.Invalid([s]).isValid())).toEqual(false);
            }));
        });
    });

    describe("isInvalid", () => {
        it("Returns false for Valid(s)", () => {
            fc.assert(fc.property(fc.string(), (s) => {
                expect(simplify(V.Valid(s).isInvalid())).toEqual(false);
            }));
        });
        it("Returns true for Invalid(s)", () => {
            fc.assert(fc.property(fc.string(), (s) => {
                expect(simplify(V.Invalid([s]).isInvalid())).toEqual(true);
            }));
        });
    });

    describe("map", () => {
        it("Passes the payload to the callback", () => {
            fc.assert(fc.property(fc.string(), (s) => { V.Valid(s).map((x) => expect(x).toEqual(s)); }));
        });
        it("Wraps the value returned by the callback", () => {
            const k = (s: string) => s.length;
            fc.assert(fc.property(fc.string(), (s) => {
                expect(simplify(V.Valid(s).map(k))).toEqual(simplify(V.Valid(k(s))));
            }));
        });
        it("Skips the callback on empty", () => {
            const k = (s: string) => s.length;
            expect(simplify(V.Invalid<[string], string>(["error"]).map(k))).toEqual(simplify(V.Invalid(["error"])));
        });
    });

    describe("mapError", () => {
        it("Passes the payload to the callback", () => {
            fc.assert(fc.property(fc.string(), (s) => { V.Invalid([s]).mapError((x) => expect(x).toEqual([s])); }));
        });
        it("Wraps the value returned by the callback", () => {
            const k = (s: string[]) => [s.length];
            fc.assert(fc.property(fc.string(), (s) => {
                expect(simplify(V.Invalid([s]).mapError(k))).toEqual(simplify(V.Invalid(k([s]))));
            }));
        });
        it("Skips the callback on empty", () => {
            const k = (s: string[]) => [s.length];
            expect(simplify(V.Valid<[string], string>("foo").mapError(k))).toEqual(simplify(V.Valid("foo")));
        });
    });

    describe("matchCase", () => {
        it("Passes the payload to the correct callback", () => {
            V.Valid("foo").matchCase({
                invalid: () => fail("Not expected to be called"),
                valid: (x) => expect(x).toEqual("foo"),
            });
            V.Invalid(["foo"]).matchCase({
                invalid: (x) => expect(x).toEqual(["foo"]),
                valid: () => fail("Not expected to be called"),
            });
        });
        it("returns the correct value when a Valid is provided", () => {
            fc.assert(fc.property(fc.string(), (s) => {
                expect(V.Valid<[string], string>(s).matchCase({
                    invalid: ([x]) => x.length - 1,
                    valid: (x) => x.length,
                })).toEqual(s.length);
            }));
        });
        it("returns the correct value when a Invalid is provided", () => {
            fc.assert(fc.property(fc.string(), (s) => {
                expect(V.Invalid<[string], string>([s]).matchCase({
                    invalid: ([x]) => x.length - 1,
                    valid: (x) => x.length,
                })).toEqual(s.length - 1);
            }));
        });
    });

    describe("or", () => {
        it("Picks the first if Valid", () => {
            expect(simplify(V.Valid("foo").or(V.Valid("bar")))).toEqual(simplify(V.Valid("foo")));
        });
        it("Picks the second if first Invalid", () => {
            expect(simplify(V.Invalid(["error"]).or(V.Valid("bar")))).toEqual(simplify(V.Valid("bar")));
        });
        it("Picks the both if both Invalid", () => {
            expect(simplify(V.Invalid(["error1"]).or(V.Invalid(["error2"]))))
                .toEqual(simplify(V.Invalid(["error2"])));
        });
    });

    describe("replace", () => {
        it("Returns something if both are Valid", () => {
            expect(simplify(V.Valid("foo").replace(V.Valid("bar")))).toEqual(simplify(V.Valid("bar")));
        });
        it("Returns Invalid if the second is Invalid", () => {
            expect(simplify(V.Valid("foo").replace(V.Invalid(["error"])))).toEqual(simplify(V.Invalid(["error"])));
        });
        it("Returns Invalid if the first is Invalid", () => {
            expect(simplify(V.Invalid(["error"]).replace(V.Valid("bar")))).toEqual(simplify(V.Invalid(["error"])));
        });
        it("Returns Invalid if both are Invalid", () => {
            expect(simplify(V.Invalid(["error1"]).replace(V.Invalid(["error2"]))))
                .toEqual(simplify(V.Invalid(["error1", "error2"])));
        });
    });

    describe("replacePure", () => {
        it("Replaces value if Valid", () => {
            expect(simplify(V.Valid("foo").replacePure(2))).toEqual(simplify(V.Valid(2)));
        });
        it("Returns Invalid if Invalid", () => {
            expect(simplify(V.Invalid(["error"]).replacePure(2))).toEqual(simplify(V.Invalid(["error"])));
        });
    });

    describe("toArray", () => {
        it("Returns singleton array if Valid", () => {
            expect(V.Valid("foo").toArray()).toEqual(["foo"]);
        });
        it("Returns empty array if Invalid", () => {
            expect(V.Invalid(["error"]).toArray()).toEqual([]);
        });
    });

    describe("toEither", () => {
        it("Returns Just if Valid", () => {
            expect(simplify(V.Valid("foo").toEither())).toEqual(simplify(Right("foo")));
        });
        it("Returns Nothing if Invalid", () => {
            expect(simplify(V.Invalid(["error"]).toEither())).toEqual(simplify(Left(["error"])));
        });
    });

    describe("toMaybe", () => {
        it("Returns Just if Valid", () => {
            expect(simplify(V.Valid("foo").toMaybe())).toEqual(simplify(Just("foo")));
        });
        it("Returns Nothing if Invalid", () => {
            expect(simplify(V.Invalid(["error"]).toMaybe())).toEqual(simplify(Nothing()));
        });
    });

    describe("toString", () => {
        it("Renders Invalid (e) as Invalid (e)", () => {
            expect(V.Invalid(["error"]).toString()).toEqual("Invalid (error)");
        });
        it("Renders Valid(s) as Valid (s)", () => {
            expect(V.Valid("foo").toString()).toEqual("Valid (foo)");
        });
    });

    describe("voidOut", () => {
        it("Returns Invalid (s) for Invalid (s)", () => {
            expect(simplify(V.Invalid(["error"]).voidOut())).toEqual(simplify(V.Invalid(["error"])));
        });
        it("Returns Valid ([]) for Valid (s)", () => {
            expect(simplify(V.Valid("foo").voidOut())).toEqual(simplify(V.Valid([])));
        });
    });
});
