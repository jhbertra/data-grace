import * as fc from "fast-check";
import { unzip } from "./array";
import { prove, simplify } from "./prelude";
import * as P from "./promise";
import { Equals } from "./utilityTypes";

/*------------------------------
  TYPE TESTS
  ------------------------------*/

// Map the fields of an object
type MapPromiseObject = Equals<
    P.MapPromise<{ bar: number, baz: string }>,
    { bar: Promise<number>, baz: Promise<string> }>;
prove<MapPromiseObject>("proof");

// Map the items of an array
type MapPromiseArray = Equals<P.MapPromise<string[]>, Array<Promise<string>>>;
prove<MapPromiseArray>("proof");

/*------------------------------
  UNIT TESTS
  ------------------------------*/

describe("build", () => {
    interface IFoo {
        bar: number;
        baz: boolean;
        qux: string;
    }

    it("equals construct + wrap when all components resolve", () => {
        fc.assert(
            fc.property(
                fc.float(),
                fc.boolean(),
                fc.string(),
                (bar: number, baz: boolean, qux: string) => {
                    expect(simplify(P.build<IFoo>({
                        bar: Promise.resolve(bar),
                        baz: Promise.resolve(baz),
                        qux: Promise.resolve(qux),
                    }))).toEqual(simplify(Promise.resolve({
                        bar,
                        baz,
                        qux,
                    })));
                }));
    });
    it("equals Nothing when any components reject", () => {
        fc.assert(
            fc.property(
                fc.float(),
                fc.boolean(),
                fc.string(),
                fc.array(fc.integer(0, 2), 1, 3),
                (bar: number, baz: boolean, qux: string, empties: number[]) => {
                    function getComponent<T>(i: number, value: T): Promise<T> {
                        return empties.find((x) => x === i) != null
                            ? Promise.reject("error")
                            : Promise.resolve(value);
                    }
                    expect(simplify(P.build<IFoo>({
                        bar: getComponent(0, bar),
                        baz: getComponent(1, baz),
                        qux: getComponent(2, qux),
                    }).catch((e) => e))).toEqual(simplify(Promise.reject("error").catch((e) => e)));
                }));
    });
});

describe("mapM and forM", () => {
    it("is equal to map + wrap for only pure results", () => {
        fc.assert(
            fc.property(
                fc.array(fc.integer()),
                (xs: number[]) => {
                    const resultForM = simplify(P.forM(xs, (x) => Promise.resolve(x.toString())));
                    const resultMapM = simplify(P.mapM((x) => Promise.resolve(x.toString()), xs));
                    expect(resultForM).toEqual(resultMapM);
                    expect(resultMapM).toEqual(simplify(Promise.resolve(xs.map((x) => x.toString()))));
                }));
    });
    it("is equal to nothing for any empty results", () => {
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
                        ? Promise.reject("Error")
                        : Promise.resolve(i.toString());

                    const resultForM = simplify(P.forM(input, mapping).catch((e) => e));
                    const resultMapM = simplify(P.mapM(mapping, input).catch((e) => e));
                    expect(resultForM).toEqual(resultMapM);
                    expect(resultMapM).toEqual(simplify(Promise.reject("error").catch((e) => e)));
                }));
    });
});

describe("join", () => {
    it("equals Nothing when outer is empty", () => {
        expect(simplify(P.join(Promise.reject("error")).catch((e) => e)))
            .toEqual(simplify(Promise.reject("error").catch((e) => e)));
    });
    it("equals Nothing when inner is empty", () => {
        expect(simplify(P.join(Promise.resolve(Promise.reject("error"))).catch((e) => e)))
            .toEqual(simplify(Promise.reject("error").catch((e) => e)));
    });
    it("equals inner when both levels non-empty", () => {
        expect(simplify(P.join(Promise.resolve<Promise<number>>(Promise.resolve(12)))))
            .toEqual(simplify(Promise.resolve(12)));
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
                    expect(simplify(P.lift(f, Promise.resolve(a), Promise.resolve(b), Promise.resolve(c))))
                        .toEqual(simplify(Promise.resolve(f(a, b, c))));
                }));
    });
    it("equals Nothing when any arguments have no value", () => {
        fc.assert(
            fc.property(
                fc.float(),
                fc.boolean(),
                fc.string(),
                fc.array(fc.integer(0, 2), 1, 3),
                (a: number, b: boolean, c: string, empties: number[]) => {
                    function getArg<T>(i: number, value: T): Promise<T> {
                        return empties.find((x) => x === i) != null
                            ? Promise.reject("error")
                            : Promise.resolve(value);
                    }

                    expect(simplify(P.lift(f, getArg(0, a), getArg(1, b), getArg(2, c)).catch((e) => e)))
                        .toEqual(simplify(Promise.reject("error").catch((e) => e)));
                }));
    });
});

describe("mapAndUnzipWith", () => {
    it("is equal to map + unzip + wrap for only pure results", () => {
        fc.assert(
            fc.property(
                fc.array(fc.tuple(fc.integer(), fc.string())),
                (xys: Array<[number, string]>) => {
                    expect(simplify(P.mapAndUnzipWith(([x, y]) => Promise.resolve<[string, number]>([y, x]), xys)))
                        .toEqual(simplify(Promise.resolve(unzip(xys.map(([x, y]) => [y, x] as [string, number])))));
                }));
    });
    it("is equal to Nothing for any empty results", () => {
        fc.assert(
            fc.property(
                fc
                    .array(fc.tuple(fc.integer(), fc.string()), 1, 10)
                    .chain((xys) => fc
                        .array(fc.integer(0, xys.length - 1), 1, xys.length)
                        .map(((empties) => [xys, empties] as [Array<[number, string]>, number[]]))),
                ([xys, empties]) => {
                    expect(simplify(
                        P.mapAndUnzipWith(
                            ([[x, y], i]) => empties.find((e) => e === i) != null
                                ? Promise.reject("error")
                                : Promise.resolve<[string, number]>([y, x]),
                            xys.map((xy, i) => [xy, i] as [[number, string], number])).catch((e) => e)))
                        .toEqual(simplify(Promise.reject("error").catch((e) => e)));
                }));
    });
});

describe("zipWithM", () => {
    it("is equal to zipWith + wrap for only pure results", () => {
        fc.assert(
            fc.property(
                fc.array(fc.string()),
                fc.array(fc.integer()),
                (strs: string[], ns: number[]) => {
                    expect(simplify(P.zipWithM((str, n) => Promise.resolve(str.length + n), strs, ns)))
                        .toEqual(simplify(Promise.resolve(strs.zipWith((str, n) => str.length + n, ns))));
                }));
    });
    it("is equal to Nothing for any empty results", () => {
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
                        P.zipWithM(
                            ([str, i], n) => predicate(i) ? Promise.resolve(str.length + n) : Promise.reject("error"),
                            strs,
                            ns).catch((e) => e)))
                        .toEqual(simplify(Promise.reject("error").catch((e) => e)));
                }));
    });
});
