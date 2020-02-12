import * as fc from "fast-check";
import { unzip } from "../src/array";
import { Either, MapEither, Maybe } from "../src";
import { prove, simplify } from "../src/prelude";
import { Equals } from "../src/utilityTypes";

/*------------------------------
  TYPE TESTS
  ------------------------------*/

// Map the fields of an object
prove<
  Equals<
    MapEither<string, { bar: number; baz: string }>,
    { bar: Either<string, number>; baz: Either<string, string> }
  >
>("proof");

// Map the items of an array
prove<Equals<MapEither<string, string[]>, Array<Either<string, string>>>>("proof");

/*------------------------------
  UNIT TESTS
  ------------------------------*/

describe("arrayToEither", () => {
  it("returns an error when input is empty", () => {
    expect(simplify(Either.arrayToEither([], "error"))).toEqual(simplify(Either.Left("error")));
  });
  it("returns the first element when the input is not empty", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer()).filter(x => x.length > 0),
        (xs: number[]) => {
          expect(simplify(Either.arrayToEither(xs, "error"))).toEqual(
            simplify(Either.Right(xs[0])),
          );
        },
      ),
    );
  });
});

describe("maybeToEither", () => {
  it("returns an error when input is empty", () => {
    expect(simplify(Either.maybeToEither(Maybe.Nothing(), "error"))).toEqual(
      simplify(Either.Left("error")),
    );
  });
  it("returns the value when the input is not empty", () => {
    fc.assert(
      fc.property(fc.anything(), a => {
        expect(simplify(Either.maybeToEither(Maybe.Just(a), "error"))).toEqual(
          simplify(Either.Right(a)),
        );
      }),
    );
  });
});

describe("build", () => {
  interface Foo {
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
            simplify(
              Either.record<string, Foo>({
                bar: Either.Right(bar),
                baz: Either.Right(baz),
                qux: Either.Right(qux),
              }),
            ),
          ).toEqual(
            simplify(
              Either.Right({
                bar,
                baz,
                qux,
              }),
            ),
          );
        },
      ),
    );
  });
  it("equals Left when any components have no value", () => {
    fc.assert(
      fc.property(
        fc.float(),
        fc.boolean(),
        fc.string(),
        fc.array(fc.integer(0, 2), 1, 3),
        (bar: number, baz: boolean, qux: string, empties: number[]) => {
          function getComponent<T>(i: number, value: T): Either<number, T> {
            return empties.find(x => x === i) !== undefined ? Either.Left(i) : Either.Right(value);
          }
          expect(
            simplify(
              Either.record<number, Foo>({
                bar: getComponent(0, bar),
                baz: getComponent(1, baz),
                qux: getComponent(2, qux),
              }),
            ),
          ).toEqual(simplify(Either.Left(empties.reduce((x, y) => Math.min(x, y), 2))));
        },
      ),
    );
  });
});

describe("lefts", () => {
  it("returns the value of every Left", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            fc.string().map(x => Either.Left<string, number>(x)),
            fc.integer().map(x => Either.Right<string, number>(x)),
          ),
        ),
        (xs: Array<Either<string, number>>) => {
          expect(Either.lefts(xs)).toEqual(xs.filter(x => x.isLeft()).map(x => (x as any).value));
        },
      ),
    );
  });
});

describe("rights", () => {
  it("returns the value of every Left", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            fc.string().map(x => Either.Left<string, number>(x)),
            fc.integer().map(x => Either.Right<string, number>(x)),
          ),
        ),
        (xs: Array<Either<string, number>>) => {
          expect(Either.rights(xs)).toEqual(xs.filter(x => x.isRight()).map(x => (x as any).value));
        },
      ),
    );
  });
});

describe("mapM and forM", () => {
  it("is equal to map + wrap for only Right results", () => {
    fc.assert(
      fc.property(fc.array(fc.integer()), (xs: number[]) => {
        const resultForM = simplify(Either.forM(xs, x => Either.Right(x.toString())));
        const resultMapM = simplify(Either.mapM(x => Either.Right(x.toString()), xs));
        expect(resultForM).toEqual(resultMapM);
        expect(resultMapM).toEqual(simplify(Either.Right(xs.map(x => x.toString()))));
      }),
    );
  });
  it("is equal to nothing for any Left results", () => {
    fc.assert(
      fc.property(
        fc
          .integer(1, 10)
          .chain(size =>
            fc
              .array(fc.integer(0, size - 1), 1, size)
              .map(empties => [size, empties] as [number, number[]]),
          ),
        ([size, empties]) => {
          const input = [];

          for (let i = 0; i < size; i++) {
            input.push(i);
          }

          const mapping = (i: number) =>
            empties.find(x => x === i) !== undefined ? Either.Left(i) : Either.Right(i.toString());

          const resultForM = simplify(Either.forM(input, mapping));
          const resultMapM = simplify(Either.mapM(mapping, input));
          expect(resultForM).toEqual(resultMapM);
          expect(resultMapM).toEqual(
            simplify(Either.Left(empties.reduce((x, y) => Math.min(x, y), size))),
          );
        },
      ),
    );
  });
});

describe("join", () => {
  it("equals Left when outer is Left", () => {
    expect(simplify(Either.join(Either.Left(1)))).toEqual(simplify(Either.Left(1)));
  });
  it("equals Left when inner is Left", () => {
    expect(simplify(Either.join(Either.Right(Either.Left(2))))).toEqual(simplify(Either.Left(2)));
  });
  it("equals inner when both levels are Right", () => {
    expect(simplify(Either.join(Either.Right(Either.Right(12))))).toEqual(
      simplify(Either.Right(12)),
    );
  });
});

describe("lift", () => {
  const f = (a: number, b: boolean, c: string) => `${a} ${b} ${c}`;
  it("equals apply + wrap when all arguments have value", () => {
    fc.assert(
      fc.property(fc.float(), fc.boolean(), fc.string(), (a: number, b: boolean, c: string) => {
        expect(simplify(Either.lift(f, Either.Right(a), Either.Right(b), Either.Right(c)))).toEqual(
          simplify(Either.Right(f(a, b, c))),
        );
      }),
    );
  });
  it("equals Left when any arguments have no value", () => {
    fc.assert(
      fc.property(
        fc.float(),
        fc.boolean(),
        fc.string(),
        fc.array(fc.integer(0, 2), 1, 3),
        (a: number, b: boolean, c: string, empties: number[]) => {
          function getArg<T>(i: number, value: T): Either<number, T> {
            return empties.find(x => x === i) !== undefined ? Either.Left(i) : Either.Right(value);
          }

          expect(simplify(Either.lift(f, getArg(0, a), getArg(1, b), getArg(2, c)))).toEqual(
            simplify(Either.Left(empties.reduce((x, y) => Math.min(x, y), 2))),
          );
        },
      ),
    );
  });
});

describe("mapAndUnzipWith", () => {
  it("is equal to map + unzip + wrap for only Right results", () => {
    fc.assert(
      fc.property(fc.array(fc.tuple(fc.integer(), fc.string())), (xys: Array<[number, string]>) => {
        expect(
          simplify(
            Either.mapAndUnzipWith(
              ([x, y]) => Either.Right<number, [string, number]>([y, x]),
              xys,
            ),
          ),
        ).toEqual(simplify(Either.Right(unzip(xys.map(([x, y]) => [y, x] as [string, number])))));
      }),
    );
  });
  it("is equal to Left for any Left results", () => {
    fc.assert(
      fc.property(
        fc
          .array(fc.tuple(fc.integer(), fc.string()), 1, 10)
          .chain(xys =>
            fc
              .array(fc.integer(0, xys.length - 1), 1, xys.length)
              .map(empties => [xys, empties] as [Array<[number, string]>, number[]]),
          ),
        ([xys, empties]) => {
          expect(
            simplify(
              Either.mapAndUnzipWith(
                ([[x, y], i]) =>
                  empties.find(e => e === i) !== undefined
                    ? Either.Left<number, [string, number]>(i)
                    : Either.Right<number, [string, number]>([y, x]),
                xys.map((xy, i) => [xy, i] as [[number, string], number]),
              ),
            ),
          ).toEqual(simplify(Either.Left(empties.reduce((x, y) => Math.min(x, y), xys.length))));
        },
      ),
    );
  });
});

describe("reduceM", () => {
  it("is equal to reduce + wrap for only Right results", () => {
    fc.assert(
      fc.property(fc.array(fc.string()), (strs: string[]) => {
        expect(
          simplify(Either.reduceM((state, str) => Either.Right(state.concat(str)), "", strs)),
        ).toEqual(simplify(Either.Right(strs.reduce((state, str) => state.concat(str), ""))));
      }),
    );
  });
  it("is equal to Left for any Left results", () => {
    fc.assert(
      fc.property(
        fc
          .array(fc.string(), 1, 10)
          .chain(strs =>
            fc
              .array(fc.integer(0, strs.length - 1), 1, strs.length)
              .map(
                empties =>
                  [strs.map((s, i) => [s, i]), empties] as [Array<[string, number]>, number[]],
              ),
          ),
        ([strs, empties]) => {
          const predicate = ([s, i]: [string, number]) => empties.find(x => x === i) === undefined;
          expect(
            simplify(
              Either.reduceM(
                (state, str) =>
                  predicate(str) ? Either.Right(state.concat(str[0])) : Either.Left(str[1]),
                "",
                strs,
              ),
            ),
          ).toEqual(simplify(Either.Left(empties.reduce((x, y) => Math.min(x, y), strs.length))));
        },
      ),
    );
  });
});

describe("sequence", () => {
  it("is equal to wrap for only Right results", () => {
    fc.assert(
      fc.property(fc.array(fc.string()), (strs: string[]) => {
        expect(simplify(Either.sequence(strs.map(Either.Right)))).toEqual(
          simplify(Either.Right(strs)),
        );
      }),
    );
  });
  it("is equal to Left for any Left results", () => {
    fc.assert(
      fc.property(
        fc
          .array(fc.string(), 1, 10)
          .chain(strs =>
            fc
              .array(fc.integer(0, strs.length - 1), 1, strs.length)
              .map(
                empties =>
                  [strs.map((s, i) => [s, i]), empties] as [Array<[string, number]>, number[]],
              ),
          ),
        ([strs, empties]) => {
          const predicate = ([s, i]: [string, number]) => empties.find(x => x === i) === undefined;
          expect(
            simplify(
              Either.sequence(
                strs.map(str => (predicate(str) ? Either.Right(str[0]) : Either.Left(str[1]))),
              ),
            ),
          ).toEqual(simplify(Either.Left(empties.reduce((x, y) => Math.min(x, y), strs.length))));
        },
      ),
    );
  });
});

describe("unless", () => {
  it("Runs the Either for false", () => {
    expect(simplify(Either.unless(false, Either.Left("error")))).toEqual(
      simplify(Either.Left("error")),
    );
  });
  it("Skips the Either for true", () => {
    expect(simplify(Either.unless(true, Either.Left("error")))).toEqual(
      simplify(Either.Right(undefined)),
    );
  });
});

describe("when", () => {
  it("Runs the Either for true", () => {
    expect(simplify(Either.when(true, Either.Left("error")))).toEqual(
      simplify(Either.Left("error")),
    );
  });
  it("Skips the Either for false", () => {
    expect(simplify(Either.when(false, Either.Left("error")))).toEqual(
      simplify(Either.Right(undefined)),
    );
  });
});

describe("zipWithM", () => {
  it("is equal to zipWith + wrap for only Right results", () => {
    fc.assert(
      fc.property(fc.array(fc.string()), fc.array(fc.integer()), (strs: string[], ns: number[]) => {
        expect(
          simplify(Either.zipWithM((str, n) => Either.Right(str.length + n), strs, ns)),
        ).toEqual(simplify(Either.Right(strs.zipWith((str, n) => str.length + n, ns))));
      }),
    );
  });
  it("is equal to Left for any Left results", () => {
    const arb = fc
      .array(fc.string(), 1, 10)
      .chain(strs =>
        fc
          .array(fc.integer(), 1, 10)
          .map(ns => [strs.map((s, i) => [s, i]), ns] as [Array<[string, number]>, number[]]),
      )
      .chain(([strs, ns]) => {
        const size = Math.min(strs.length, ns.length);
        return fc
          .array(fc.integer(0, size - 1), 1, size)
          .map(empties => [strs, ns, empties] as [Array<[string, number]>, number[], number[]]);
      });

    fc.assert(
      fc.property(arb, ([strs, ns, empties]) => {
        const predicate = (i: number) => empties.find(x => x === i) === undefined;
        expect(
          simplify(
            Either.zipWithM(
              ([str, i], n) => (predicate(i) ? Either.Right(str.length + n) : Either.Left(i)),
              strs,
              ns,
            ),
          ),
        ).toEqual(
          simplify(
            Either.Left(empties.reduce((x, y) => Math.min(x, y), Math.min(strs.length, ns.length))),
          ),
        );
      }),
    );
  });
});

describe("IEither", () => {
  it("obeys the left identity monad law", () => {
    const k = (s: string) => (s.length < 4 ? Either.Right(s.length) : Either.Left("error"));
    fc.assert(
      fc.property(fc.string(), s => {
        expect(simplify(Either.Right(s).chain(k))).toEqual(simplify(k(s)));
      }),
    );
  });

  it("obeys the right identity monad law", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.string().map(x => Either.Left<string, string>(x)),
          fc.string().map(x => Either.Right<string, string>(x)),
        ),
        m => {
          expect(simplify(m.chain(Either.Right))).toEqual(simplify(m));
        },
      ),
    );
  });

  it("obeys the right monad associativity law", () => {
    const k = (s: string) =>
      s.length < 4 ? Either.Right<string, number>(s.length) : Either.Left<string, number>("error1");
    const h = (n: number) =>
      n % 2 === 0
        ? Either.Right<string, string>(n.toString())
        : Either.Left<string, string>("error2");

    fc.assert(
      fc.property(
        fc.oneof(
          fc.string().map(x => Either.Left<string, string>(x)),
          fc.string().map(x => Either.Right<string, string>(x)),
        ),
        m => {
          expect(simplify(m.chain(x => k(x).chain(h)))).toEqual(simplify(m.chain(k).chain(h)));
        },
      ),
    );
  });

  describe("defaultLeftWith", () => {
    it("Returns default when Right", () => {
      fc.assert(
        fc.property(fc.string(), s => {
          expect(Either.Right(s).defaultLeftWith("foo")).toEqual("foo");
        }),
      );
    });
    it("Returns payload when Left", () => {
      fc.assert(
        fc.property(fc.string(), s => {
          expect(Either.Left(s).defaultLeftWith("foo")).toEqual(s);
        }),
      );
    });
  });

  describe("defaultRightWith", () => {
    it("Returns default when Left", () => {
      fc.assert(
        fc.property(fc.string(), s => {
          expect(Either.Left(s).defaultRightWith("foo")).toEqual("foo");
        }),
      );
    });
    it("Returns payload when Right", () => {
      fc.assert(
        fc.property(fc.string(), s => {
          expect(Either.Right(s).defaultRightWith("foo")).toEqual(s);
        }),
      );
    });
  });

  describe("chain", () => {
    it("Passes the payload to the callback", () => {
      fc.assert(
        fc.property(fc.string(), s => {
          Either.Right(s).chain(x => Either.Right(expect(x).toEqual(s)));
        }),
      );
    });
    it("Returns the value returned by the callback", () => {
      const k = (s: string) =>
        s.length < 5 ? Either.Right<string, string>(s) : Either.Left<string, string>("error");
      fc.assert(
        fc.property(fc.string(), s => {
          expect(simplify(Either.Right(s).chain(k))).toEqual(simplify(k(s)));
        }),
      );
    });
    it("Skips the callback on empty", () => {
      const k = (s: string) =>
        s.length < 5 ? Either.Right<string, string>(s) : Either.Left<string, string>("error");
      expect(simplify(Either.Left<string, string>("error").chain(k))).toEqual(
        simplify(Either.Left("error")),
      );
    });
  });

  describe("isRight", () => {
    it("Returns true for Right(s)", () => {
      fc.assert(
        fc.property(fc.string(), s => {
          expect(simplify(Either.Right(s).isRight())).toEqual(true);
        }),
      );
    });
    it("Returns false for Left(s)", () => {
      fc.assert(
        fc.property(fc.string(), s => {
          expect(simplify(Either.Left(s).isRight())).toEqual(false);
        }),
      );
    });
  });

  describe("isLeft", () => {
    it("Returns false for Right(s)", () => {
      fc.assert(
        fc.property(fc.string(), s => {
          expect(simplify(Either.Right(s).isLeft())).toEqual(false);
        }),
      );
    });
    it("Returns true for Left(s)", () => {
      fc.assert(
        fc.property(fc.string(), s => {
          expect(simplify(Either.Left(s).isLeft())).toEqual(true);
        }),
      );
    });
  });

  describe("map", () => {
    it("Passes the payload to the callback", () => {
      fc.assert(
        fc.property(fc.string(), s => {
          Either.Right(s).map(x => expect(x).toEqual(s));
        }),
      );
    });
    it("Wraps the value returned by the callback", () => {
      const k = (s: string) => s.length;
      fc.assert(
        fc.property(fc.string(), s => {
          expect(simplify(Either.Right(s).map(k))).toEqual(simplify(Either.Right(k(s))));
        }),
      );
    });
    it("Skips the callback on empty", () => {
      const k = (s: string) => s.length;
      expect(simplify(Either.Left<string, string>("error").map(k))).toEqual(
        simplify(Either.Left("error")),
      );
    });
  });

  describe("mapLeft", () => {
    it("Passes the payload to the callback", () => {
      fc.assert(
        fc.property(fc.string(), s => {
          Either.Left(s).mapLeft(x => expect(x).toEqual(s));
        }),
      );
    });
    it("Wraps the value returned by the callback", () => {
      const k = (s: string) => s.length;
      fc.assert(
        fc.property(fc.string(), s => {
          expect(simplify(Either.Left(s).mapLeft(k))).toEqual(simplify(Either.Left(k(s))));
        }),
      );
    });
    it("Skips the callback on empty", () => {
      const k = (s: string) => s.length;
      expect(simplify(Either.Right<string, string>("foo").mapLeft(k))).toEqual(
        simplify(Either.Right("foo")),
      );
    });
  });

  describe("matchCase", () => {
    it("Passes the payload to the correct callback", () => {
      Either.Right("foo").matchCase({
        left: () => fail("Not expected to be called"),
        right: x => expect(x).toEqual("foo"),
      });
      Either.Left("foo").matchCase({
        left: x => expect(x).toEqual("foo"),
        right: () => fail("Not expected to be called"),
      });
    });
    it("returns the correct value when a Right is provided", () => {
      fc.assert(
        fc.property(fc.string(), s => {
          expect(
            Either.Right<string, string>(s).matchCase({
              right: x => x.length,
              left: x => x.length - 1,
            }),
          ).toEqual(s.length);
        }),
      );
    });
    it("returns the correct value when a Left is provided", () => {
      fc.assert(
        fc.property(fc.string(), s => {
          expect(
            Either.Left<string, string>(s).matchCase({
              right: x => x.length,
              left: () => s.length - 1,
            }),
          ).toEqual(s.length - 1);
        }),
      );
    });
  });

  describe("or", () => {
    it("Picks the first if Right", () => {
      expect(simplify(Either.Right("foo").or(Either.Right("bar")))).toEqual(
        simplify(Either.Right("foo")),
      );
    });
    it("Picks the second if first Left", () => {
      expect(simplify(Either.Left("error").or(Either.Right("bar")))).toEqual(
        simplify(Either.Right("bar")),
      );
    });
    it("Picks the second if both Left", () => {
      expect(simplify(Either.Left("error1").or(Either.Left("error2")))).toEqual(
        simplify(Either.Left("error2")),
      );
    });
  });

  describe("replace", () => {
    it("Returns something if both are Right", () => {
      expect(simplify(Either.Right("foo").replace(Either.Right("bar")))).toEqual(
        simplify(Either.Right("bar")),
      );
    });
    it("Returns Left if the second is Left", () => {
      expect(simplify(Either.Right("foo").replace(Either.Left("error")))).toEqual(
        simplify(Either.Left("error")),
      );
    });
    it("Returns Left if the first is Left", () => {
      expect(simplify(Either.Left("error").replace(Either.Right("bar")))).toEqual(
        simplify(Either.Left("error")),
      );
    });
    it("Returns Left if both are Left", () => {
      expect(simplify(Either.Left("error1").replace(Either.Left("error2")))).toEqual(
        simplify(Either.Left("error1")),
      );
    });
  });

  describe("replacePure", () => {
    it("Replaces value if Right", () => {
      expect(simplify(Either.Right("foo").replacePure(2))).toEqual(simplify(Either.Right(2)));
    });
    it("Returns Left if Left", () => {
      expect(simplify(Either.Left("error").replacePure(2))).toEqual(simplify(Either.Left("error")));
    });
  });

  describe("swap", () => {
    it("Replaces Left with Right", () => {
      expect(simplify(Either.Right("foo").swap())).toEqual(simplify(Either.Left("foo")));
    });
    it("Replaces Right with Left", () => {
      expect(simplify(Either.Left("error").swap())).toEqual(simplify(Either.Right("error")));
    });
    it("Applying twice is equivalent to id", () => {
      fc.assert(
        fc.property(fc.anything(), a => {
          expect(
            simplify(
              Either.Right(a)
                .swap()
                .swap(),
            ),
          ).toEqual(simplify(Either.Right(a)));
          expect(
            simplify(
              Either.Left(a)
                .swap()
                .swap(),
            ),
          ).toEqual(simplify(Either.Left(a)));
        }),
      );
    });
  });

  describe("toArray", () => {
    it("Returns singleton array if Right", () => {
      expect(Either.Right("foo").toArray()).toEqual(["foo"]);
    });
    it("Returns empty array if Left", () => {
      expect(Either.Left("error").toArray()).toEqual([]);
    });
  });

  describe("toMaybe", () => {
    it("Returns Maybe.Just if Right", () => {
      expect(simplify(Either.Right("foo").toMaybe())).toEqual(simplify(Maybe.Just("foo")));
    });
    it("Returns Maybe.Nothing if Left", () => {
      expect(simplify(Either.Left("error").toMaybe())).toEqual(simplify(Maybe.Nothing()));
    });
  });

  describe("leftToMaybe", () => {
    it("Returns Maybe.Nothing if Right", () => {
      expect(simplify(Either.Right("foo").leftToMaybe())).toEqual(simplify(Maybe.Nothing()));
    });
    it("Returns Maybe.Just if Left", () => {
      expect(simplify(Either.Left("error").leftToMaybe())).toEqual(simplify(Maybe.Just("error")));
    });
  });

  describe("toString", () => {
    it("Renders Left (e) as Left (e)", () => {
      expect(Either.Left("error").toString()).toEqual("Left (error)");
    });
    it("Renders Right(s) as Right (s)", () => {
      expect(Either.Right("foo").toString()).toEqual("Right (foo)");
    });
  });

  describe("voidOut", () => {
    it("Returns Left (s) for Left (s)", () => {
      expect(simplify(Either.Left("error").voidOut())).toEqual(simplify(Either.Left("error")));
    });
    it("Returns Right ([]) for Right (s)", () => {
      expect(simplify(Either.Right("foo").voidOut())).toEqual(simplify(Either.Right(undefined)));
    });
  });
});

export const arbitraryEither = <a, b>(arbA: fc.Arbitrary<a>, arbB: fc.Arbitrary<b>) =>
  fc.oneof(arbA.map<Either<a, b>>(Either.Left), arbB.map<Either<a, b>>(Either.Right));
