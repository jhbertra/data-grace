import * as fc from "fast-check";
import { unzip } from "./array";
import * as E from "./either";
import { Just, Nothing } from "./maybe";
import { prove, simplify } from "./prelude";
import { Equals } from "./utilityTypes";

/*------------------------------
  TYPE TESTS
  ------------------------------*/

// Map the fields of an object
prove<Equals<
    E.MapEither<string, { bar: number, baz: string }>,
    { bar: E.Either<string, number>, baz: E.Either<string, string> }>
>("proof");

// Map the items of an array
prove<Equals<E.MapEither<string, string[]>, Array<E.Either<string, string>>>>("proof");

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
                    expect(simplify(E.build<string, IFoo>({
                        bar: E.Right(bar),
                        baz: E.Right(baz),
                        qux: E.Right(qux),
                    }))).toEqual(simplify(E.Right({
                        bar,
                        baz,
                        qux,
                    })));
                }));
    });
    it("equals Left when any components have no value", () => {
        fc.assert(
            fc.property(
                fc.float(),
                fc.boolean(),
                fc.string(),
                fc.array(fc.integer(0, 2), 1, 3),
                (bar: number, baz: boolean, qux: string, empties: number[]) => {
                    function getComponent<T>(i: number, value: T): E.Either<number, T> {
                        return empties.find((x) => x === i) != null
                            ? E.Left(i)
                            : E.Right(value);
                    }
                    expect(simplify(E.build<number, IFoo>({
                        bar: getComponent(0, bar),
                        baz: getComponent(1, baz),
                        qux: getComponent(2, qux),
                    }))).toEqual(simplify(E.Left(empties.reduce((x, y) => Math.min(x, y), 2))));
                }));
    });
});

describe("lefts", () => {
    it("returns the value of every Left", () => {
        fc.assert(
            fc.property(
                fc.array(fc.oneof(
                    fc.string().map((x) => E.Left<string, number>(x)),
                    fc.integer().map((x) => E.Right<string, number>(x)))),
                (xs: Array<E.Either<string, number>>) => {
                    expect(E.lefts(xs)).toEqual(xs.filter((x) => x.isLeft()).map((x) => (x as any).value));
                }));
    });
});

describe("rights", () => {
    it("returns the value of every Left", () => {
        fc.assert(
            fc.property(
                fc.array(fc.oneof(
                    fc.string().map((x) => E.Left<string, number>(x)),
                    fc.integer().map((x) => E.Right<string, number>(x)))),
                (xs: Array<E.Either<string, number>>) => {
                    expect(E.rights(xs)).toEqual(xs.filter((x) => x.isRight()).map((x) => (x as any).value));
                }));
    });
});

describe("mapM and forM", () => {
    it("is equal to map + wrap for only Right results", () => {
        fc.assert(
            fc.property(
                fc.array(fc.integer()),
                (xs: number[]) => {
                    const resultForM = simplify(E.forM(xs, (x) => E.Right(x.toString())));
                    const resultMapM = simplify(E.mapM((x) => E.Right(x.toString()), xs));
                    expect(resultForM).toEqual(resultMapM);
                    expect(resultMapM).toEqual(simplify(E.Right(xs.map((x) => x.toString()))));
                }));
    });
    it("is equal to nothing for any Left results", () => {
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
                        ? E.Left(i)
                        : E.Right(i.toString());

                    const resultForM = simplify(E.forM(input, mapping));
                    const resultMapM = simplify(E.mapM(mapping, input));
                    expect(resultForM).toEqual(resultMapM);
                    expect(resultMapM).toEqual(simplify(E.Left(empties.reduce((x, y) => Math.min(x, y), size))));
                }));
    });
});

describe("join", () => {
    it("equals Left when outer is Left", () => {
        expect(simplify(E.join(E.Left(1)))).toEqual(simplify(E.Left(1)));
    });
    it("equals Left when inner is Left", () => {
        expect(simplify(E.join(E.Right(E.Left(2))))).toEqual(simplify(E.Left(2)));
    });
    it("equals inner when both levels are Right", () => {
        expect(simplify(E.join(E.Right(E.Right(12))))).toEqual(simplify(E.Right(12)));
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
                    expect(simplify(E.lift(f, E.Right(a), E.Right(b), E.Right(c))))
                        .toEqual(simplify(E.Right(f(a, b, c))));
                }));
    });
    it("equals Left when any arguments have no value", () => {
        fc.assert(
            fc.property(
                fc.float(),
                fc.boolean(),
                fc.string(),
                fc.array(fc.integer(0, 2), 1, 3),
                (a: number, b: boolean, c: string, empties: number[]) => {
                    function getArg<T>(i: number, value: T): E.Either<number, T> {
                        return empties.find((x) => x === i) != null
                            ? E.Left(i)
                            : E.Right(value);
                    }

                    expect(simplify(E.lift(f, getArg(0, a), getArg(1, b), getArg(2, c))))
                        .toEqual(simplify(E.Left(empties.reduce((x, y) => Math.min(x, y), 2))));
                }));
    });
});

describe("mapAndUnzipWith", () => {
    it("is equal to map + unzip + wrap for only Right results", () => {
        fc.assert(
            fc.property(
                fc.array(fc.tuple(fc.integer(), fc.string())),
                (xys: Array<[number, string]>) => {
                    expect(simplify(E.mapAndUnzipWith(([x, y]) => E.Right<number, [string, number]>([y, x]), xys)))
                        .toEqual(simplify(E.Right(unzip(xys.map(([x, y]) => [y, x] as [string, number])))));
                }));
    });
    it("is equal to Left for any Left results", () => {
        fc.assert(
            fc.property(
                fc
                    .array(fc.tuple(fc.integer(), fc.string()), 1, 10)
                    .chain((xys) => fc
                        .array(fc.integer(0, xys.length - 1), 1, xys.length)
                        .map(((empties) => [xys, empties] as [Array<[number, string]>, number[]]))),
                ([xys, empties]) => {
                    expect(simplify(
                        E.mapAndUnzipWith(
                            ([[x, y], i]) => empties.find((e) => e === i) != null
                                ? E.Left<number, [string, number]>(i)
                                : E.Right<number, [string, number]>([y, x]),
                            xys.map((xy, i) => [xy, i] as [[number, string], number]))))
                        .toEqual(simplify(E.Left(empties.reduce((x, y) => Math.min(x, y), xys.length))));
                }));
    });
});

describe("reduceM", () => {
    it("is equal to reduce + wrap for only Right results", () => {
        fc.assert(
            fc.property(
                fc.array(fc.string()),
                (strs: string[]) => {
                    expect(simplify(E.reduceM((state, str) => E.Right(state.concat(str)), "", strs)))
                        .toEqual(simplify(E.Right(strs.reduce((state, str) => state.concat(str), ""))));
                }));
    });
    it("is equal to Left for any Left results", () => {
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
                        E.reduceM(
                            (state, str) => predicate(str) ? E.Right(state.concat(str[0])) : E.Left(str[1]),
                            "",
                            strs)))
                        .toEqual(simplify(E.Left(empties.reduce((x, y) => Math.min(x, y), strs.length))));
                }));
    });
});

describe("sequence", () => {
    it("is equal to wrap for only Right results", () => {
        fc.assert(
            fc.property(
                fc.array(fc.string()),
                (strs: string[]) => {
                    expect(simplify(E.sequence(strs.map(E.Right)))).toEqual(simplify(E.Right(strs)));
                }));
    });
    it("is equal to Left for any Left results", () => {
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
                    expect(simplify(E.sequence(strs.map((str) => predicate(str) ? E.Right(str[0]) : E.Left(str[1])))))
                        .toEqual(simplify(E.Left(empties.reduce((x, y) => Math.min(x, y), strs.length))));
                }));
    });
});

describe("unless", () => {
    it("Runs the Either for false", () => {
        expect(simplify(E.unless(false, E.Left("error")))).toEqual(simplify(E.Left("error")));
    });
    it("Skips the Either for true", () => {
        expect(simplify(E.unless(true, E.Left("error")))).toEqual(simplify(E.Right([])));
    });
});

describe("when", () => {
    it("Runs the Either for true", () => {
        expect(simplify(E.when(true, E.Left("error")))).toEqual(simplify(E.Left("error")));
    });
    it("Skips the Either for false", () => {
        expect(simplify(E.when(false, E.Left("error")))).toEqual(simplify(E.Right([])));
    });
});

describe("zipWithM", () => {
    it("is equal to zipWith + wrap for only Right results", () => {
        fc.assert(
            fc.property(
                fc.array(fc.string()),
                fc.array(fc.integer()),
                (strs: string[], ns: number[]) => {
                    expect(simplify(E.zipWithM((str, n) => E.Right(str.length + n), strs, ns)))
                        .toEqual(simplify(E.Right(strs.zipWith((str, n) => str.length + n, ns))));
                }));
    });
    it("is equal to Left for any Left results", () => {
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
                        E.zipWithM(
                            ([str, i], n) => predicate(i) ? E.Right(str.length + n) : E.Left(i),
                            strs,
                            ns)))
                        .toEqual(simplify(E.Left(
                            empties.reduce((x, y) => Math.min(x, y), Math.min(strs.length, ns.length)))));
                }));
    });
});

describe("IEither", () => {
    it("obeys the left identity monad law", () => {
        const k = (s: string) => s.length < 4 ? E.Right(s.length) : E.Left("error");
        fc.assert(fc.property(fc.string(), (s) => {
            expect(simplify(E.Right(s).chain(k))).toEqual(simplify(k(s)));
        }));
    });

    it("obeys the right identity monad law", () => {
        fc.assert(
            fc.property(fc.oneof(
                fc.string().map((x) => E.Left<string, string>(x)),
                fc.string().map((x) => E.Right<string, string>(x))),
                (m) => {
                    expect(simplify(m.chain(E.Right))).toEqual(simplify(m));
                }));
    });

    it("obeys the right monad associativity law", () => {
        const k = (s: string) => s.length < 4 ? E.Right<string, number>(s.length) : E.Left<string, number>("error1");
        const h = (n: number) => n % 2 === 0 ? E.Right<string, string>(n.toString()) : E.Left<string, string>("error2");

        fc.assert(
            fc.property(fc.oneof(
                fc.string().map((x) => E.Left<string, string>(x)),
                fc.string().map((x) => E.Right<string, string>(x))),
                (m) => {
                    expect(simplify(m.chain((x) => k(x).chain(h)))).toEqual(simplify(m.chain(k).chain(h)));
                }));
    });

    describe("defaultLeftWith", () => {
        it("Returns default when Right", () => {
            fc.assert(fc.property(fc.string(), (s) => { expect(E.Right(s).defaultLeftWith("foo")).toEqual("foo"); }));
        });
        it("Returns payload when Left", () => {
            fc.assert(fc.property(fc.string(), (s) => { expect(E.Left(s).defaultLeftWith("foo")).toEqual(s); }));
        });
    });

    describe("defaultRightWith", () => {
        it("Returns default when Left", () => {
            fc.assert(fc.property(fc.string(), (s) => { expect(E.Left(s).defaultRightWith("foo")).toEqual("foo"); }));
        });
        it("Returns payload when Right", () => {
            fc.assert(fc.property(fc.string(), (s) => { expect(E.Right(s).defaultRightWith("foo")).toEqual(s); }));
        });
    });

    describe("chain", () => {
        it("Passes the payload to the callback", () => {
            fc.assert(fc.property(fc.string(), (s) => { E.Right(s).chain((x) => E.Right(expect(x).toEqual(s))); }));
        });
        it("Returns the value returned by the callback", () => {
            const k = (s: string) => s.length < 5 ? E.Right<string, string>(s) : E.Left<string, string>("error");
            fc.assert(fc.property(fc.string(), (s) => {
                expect(simplify(E.Right(s).chain(k))).toEqual(simplify(k(s)));
            }));
        });
        it("Skips the callback on empty", () => {
            const k = (s: string) => s.length < 5 ? E.Right<string, string>(s) : E.Left<string, string>("error");
            expect(simplify(E.Left<string, string>("error").chain(k))).toEqual(simplify(E.Left("error")));
        });
    });

    describe("isRight", () => {
        it("Returns true for Right(s)", () => {
            fc.assert(fc.property(fc.string(), (s) => {
                expect(simplify(E.Right(s).isRight())).toEqual(true);
            }));
        });
        it("Returns false for Left(s)", () => {
            fc.assert(fc.property(fc.string(), (s) => {
                expect(simplify(E.Left(s).isRight())).toEqual(false);
            }));
        });
    });

    describe("isLeft", () => {
        it("Returns false for Right(s)", () => {
            fc.assert(fc.property(fc.string(), (s) => {
                expect(simplify(E.Right(s).isLeft())).toEqual(false);
            }));
        });
        it("Returns true for Left(s)", () => {
            fc.assert(fc.property(fc.string(), (s) => {
                expect(simplify(E.Left(s).isLeft())).toEqual(true);
            }));
        });
    });

    describe("map", () => {
        it("Passes the payload to the callback", () => {
            fc.assert(fc.property(fc.string(), (s) => { E.Right(s).map((x) => expect(x).toEqual(s)); }));
        });
        it("Wraps the value returned by the callback", () => {
            const k = (s: string) => s.length;
            fc.assert(fc.property(fc.string(), (s) => {
                expect(simplify(E.Right(s).map(k))).toEqual(simplify(E.Right(k(s))));
            }));
        });
        it("Skips the callback on empty", () => {
            const k = (s: string) => s.length;
            expect(simplify(E.Left<string, string>("error").map(k))).toEqual(simplify(E.Left("error")));
        });
    });

    describe("mapLeft", () => {
        it("Passes the payload to the callback", () => {
            fc.assert(fc.property(fc.string(), (s) => { E.Left(s).mapLeft((x) => expect(x).toEqual(s)); }));
        });
        it("Wraps the value returned by the callback", () => {
            const k = (s: string) => s.length;
            fc.assert(fc.property(fc.string(), (s) => {
                expect(simplify(E.Left(s).mapLeft(k))).toEqual(simplify(E.Left(k(s))));
            }));
        });
        it("Skips the callback on empty", () => {
            const k = (s: string) => s.length;
            expect(simplify(E.Right<string, string>("foo").mapLeft(k))).toEqual(simplify(E.Right("foo")));
        });
    });

    describe("matchCase", () => {
        it("Passes the payload to the correct callback", () => {
            E.Right("foo").matchCase({
                left: () => fail("Not expected to be called"),
                right: (x) => expect(x).toEqual("foo"),
            });
            E.Left("foo").matchCase({
                left: (x) => expect(x).toEqual("foo"),
                right: () => fail("Not expected to be called"),
            });
        });
        it("returns the correct value when a Right is provided", () => {
            fc.assert(fc.property(fc.string(), (s) => {
                expect(E.Right<string, string>(s).matchCase({ right: (x) => x.length, left: (x) => x.length - 1 }))
                    .toEqual(s.length);
            }));
        });
        it("returns the correct value when a Left is provided", () => {
            fc.assert(fc.property(fc.string(), (s) => {
                expect(E.Left<string, string>(s).matchCase({ right: (x) => x.length, left: () => s.length - 1 }))
                    .toEqual(s.length - 1);
            }));
        });
    });

    describe("or", () => {
        it("Picks the first if Right", () => {
            expect(simplify(E.Right("foo").or(E.Right("bar")))).toEqual(simplify(E.Right("foo")));
        });
        it("Picks the second if first Left", () => {
            expect(simplify(E.Left("error").or(E.Right("bar")))).toEqual(simplify(E.Right("bar")));
        });
        it("Picks the second if both Left", () => {
            expect(simplify(E.Left("error1").or(E.Left("error2")))).toEqual(simplify(E.Left("error2")));
        });
    });

    describe("replace", () => {
        it("Returns something if both are Right", () => {
            expect(simplify(E.Right("foo").replace(E.Right("bar")))).toEqual(simplify(E.Right("bar")));
        });
        it("Returns Left if the second is Left", () => {
            expect(simplify(E.Right("foo").replace(E.Left("error")))).toEqual(simplify(E.Left("error")));
        });
        it("Returns Left if the first is Left", () => {
            expect(simplify(E.Left("error").replace(E.Right("bar")))).toEqual(simplify(E.Left("error")));
        });
        it("Returns Left if both are Left", () => {
            expect(simplify(E.Left("error1").replace(E.Left("error2")))).toEqual(simplify(E.Left("error1")));
        });
    });

    describe("replacePure", () => {
        it("Replaces value if Right", () => {
            expect(simplify(E.Right("foo").replacePure(2))).toEqual(simplify(E.Right(2)));
        });
        it("Returns Left if Left", () => {
            expect(simplify(E.Left("error").replacePure(2))).toEqual(simplify(E.Left("error")));
        });
    });

    describe("toArray", () => {
        it("Returns singleton array if Right", () => {
            expect(E.Right("foo").toArray()).toEqual(["foo"]);
        });
        it("Returns empty array if Left", () => {
            expect(E.Left("error").toArray()).toEqual([]);
        });
    });

    describe("toMaybe", () => {
        it("Returns Just if Right", () => {
            expect(simplify(E.Right("foo").toMaybe())).toEqual(simplify(Just("foo")));
        });
        it("Returns Nothing if Left", () => {
            expect(simplify(E.Left("error").toMaybe())).toEqual(simplify(Nothing()));
        });
    });

    describe("toString", () => {
        it("Renders Left (e) as Left (e)", () => {
            expect(E.Left("error").toString()).toEqual("Left (error)");
        });
        it("Renders Right(s) as Right (s)", () => {
            expect(E.Right("foo").toString()).toEqual("Right (foo)");
        });
    });

    describe("voidOut", () => {
        it("Returns Left (s) for Left (s)", () => {
            expect(simplify(E.Left("error").voidOut())).toEqual(simplify(E.Left("error")));
        });
        it("Returns Right ([]) for Right (s)", () => {
            expect(simplify(E.Right("foo").voidOut())).toEqual(simplify(E.Right([])));
        });
    });
});
