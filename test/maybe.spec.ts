import * as fc from "fast-check";
import { unzip } from "../src/array";
import { MapMaybe, Maybe } from "../src";
import { constant, prove, simplify } from "../src/prelude";
import { Equals } from "../src/utilityTypes";

/*------------------------------
  TYPE TESTS
  ------------------------------*/

// Map the fields of an object
type MapMaybeObject = Equals<
  MapMaybe<{ bar: number; baz: string }>,
  { bar: Maybe<number>; baz: Maybe<string> }
>;
prove<MapMaybeObject>("proof");

// Map the items of an array
type MapMaybeArray = Equals<MapMaybe<string[]>, Array<Maybe<string>>>;
prove<MapMaybeArray>("proof");

/*------------------------------
  UNIT TESTS
  ------------------------------*/

describe("arrayToMaybe", () => {
  it("returns nothing when input is empty", () => {
    expect(simplify(Maybe.arrayToMaybe([]))).toEqual(simplify(Maybe.Nothing()));
  });
  it("returns the first element when the input is not empty", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer()).filter(x => x.length > 0),
        (xs: number[]) => {
          expect(simplify(Maybe.arrayToMaybe(xs))).toEqual(simplify(Maybe.Just(xs[0])));
        },
      ),
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
        fc.record({
          bar: fc.float(),
          baz: fc.boolean(),
          qux: fc.string(),
        }),
        r => {
          expect(
            simplify(
              Maybe.record<Foo>({
                bar: Maybe.Just(r.bar),
                baz: Maybe.Just(r.baz),
                qux: Maybe.Just(r.qux),
              }),
            ),
          ).toEqual(simplify(Maybe.Just(r)));
        },
      ),
    );
  });
  it("equals Nothing when any components have no value", () => {
    fc.assert(
      fc.property(
        fc.float(),
        fc.boolean(),
        fc.string(),
        fc.array(fc.integer(0, 2), 1, 3),
        (bar: number, baz: boolean, qux: string, empties: number[]) => {
          function getComponent<T>(i: number, value: T): Maybe<T> {
            return empties.find(x => x === i) !== undefined ? Maybe.Nothing() : Maybe.Just(value);
          }
          expect(
            simplify(
              Maybe.record<Foo>({
                bar: getComponent(0, bar),
                baz: getComponent(1, baz),
                qux: getComponent(2, qux),
              }),
            ),
          ).toEqual(simplify(Maybe.Nothing()));
        },
      ),
    );
  });
});

describe("catMaybes", () => {
  it("returns every Maybe with a value", () => {
    fc.assert(
      fc.property(
        fc.array(fc.oneof(fc.constant(Maybe.Nothing<number>()), fc.integer().map(Maybe.Just))),
        (xs: Array<Maybe<number>>) => {
          expect(Maybe.catMaybes(xs)).toEqual(
            xs.filter(x => x.isJust()).map(x => (x as any).value),
          );
        },
      ),
    );
  });
});

describe("mapM and forM", () => {
  it("is equal to map + wrap for only pure results", () => {
    fc.assert(
      fc.property(fc.array(fc.integer()), (xs: number[]) => {
        const resultForM = simplify(Maybe.forM(xs, x => Maybe.Just(x.toString())));
        const resultMapM = simplify(Maybe.mapM(x => Maybe.Just(x.toString()), xs));
        expect(resultForM).toEqual(resultMapM);
        expect(resultMapM).toEqual(simplify(Maybe.Just(xs.map(x => x.toString()))));
      }),
    );
  });
  it("is equal to nothing for any empty results", () => {
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
            empties.find(x => x === i) !== undefined
              ? Maybe.Nothing<string>()
              : Maybe.Just(i.toString());

          const resultForM = simplify(Maybe.forM(input, mapping));
          const resultMapM = simplify(Maybe.mapM(mapping, input));
          expect(resultForM).toEqual(resultMapM);
          expect(resultMapM).toEqual(simplify(Maybe.Nothing()));
        },
      ),
    );
  });
});

describe("join", () => {
  it("equals Nothing when outer is empty", () => {
    expect(simplify(Maybe.join(Maybe.Nothing()))).toEqual(simplify(Maybe.Nothing()));
  });
  it("equals Nothing when inner is empty", () => {
    expect(simplify(Maybe.join(Maybe.Just(Maybe.Nothing())))).toEqual(simplify(Maybe.Nothing()));
  });
  it("equals inner when both levels non-empty", () => {
    expect(simplify(Maybe.join(Maybe.Just(Maybe.Just(12))))).toEqual(simplify(Maybe.Just(12)));
  });
});

describe("lift", () => {
  const f = (a: number, b: boolean, c: string) => `${a} ${b} ${c}`;
  it("equals apply + wrap when all arguments have value", () => {
    fc.assert(
      fc.property(fc.float(), fc.boolean(), fc.string(), (a: number, b: boolean, c: string) => {
        expect(simplify(Maybe.lift(f, Maybe.Just(a), Maybe.Just(b), Maybe.Just(c)))).toEqual(
          simplify(Maybe.Just(f(a, b, c))),
        );
      }),
    );
  });
  it("equals Nothing when any arguments have no value", () => {
    fc.assert(
      fc.property(
        fc.float(),
        fc.boolean(),
        fc.string(),
        fc.array(fc.integer(0, 2), 1, 3),
        (a: number, b: boolean, c: string, empties: number[]) => {
          function getArg<T>(i: number, value: T): Maybe<T> {
            return empties.find(x => x === i) !== undefined ? Maybe.Nothing() : Maybe.Just(value);
          }

          expect(simplify(Maybe.lift(f, getArg(0, a), getArg(1, b), getArg(2, c)))).toEqual(
            simplify(Maybe.Nothing()),
          );
        },
      ),
    );
  });
});

describe("mapAndUnzipWith", () => {
  it("is equal to map + unzip + wrap for only pure results", () => {
    fc.assert(
      fc.property(fc.array(fc.tuple(fc.integer(), fc.string())), (xys: Array<[number, string]>) => {
        expect(
          simplify(
            Maybe.mapAndUnzipWith(
              ([x, y]) => Maybe.Just<[string, number]>([y, x]),
              xys,
            ),
          ),
        ).toEqual(simplify(Maybe.Just(unzip(xys.map(([x, y]) => [y, x] as [string, number])))));
      }),
    );
  });
  it("is equal to Nothing for any empty results", () => {
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
              Maybe.mapAndUnzipWith(
                ([[x, y], i]) =>
                  empties.find(e => e === i) !== undefined
                    ? Maybe.Nothing<[string, number]>()
                    : Maybe.Just<[string, number]>([y, x]),
                xys.map((xy, i) => [xy, i] as [[number, string], number]),
              ),
            ),
          ).toEqual(simplify(Maybe.Nothing()));
        },
      ),
    );
  });
});

describe("mapMaybe", () => {
  it("is equal to map for only pure results", () => {
    fc.assert(
      fc.property(fc.array(fc.string()), (strs: string[]) => {
        expect(Maybe.mapMaybe(str => Maybe.Just(str.length), strs)).toEqual(
          strs.map(str => str.length),
        );
      }),
    );
  });
  it("is equal to filter + map for discarding results", () => {
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
            Maybe.mapMaybe(
              str => (predicate(str) ? Maybe.Just(str.length) : Maybe.Nothing()),
              strs,
            ),
          ).toEqual(strs.filter(predicate).map(str => str.length));
        },
      ),
    );
  });
});

describe("reduceM", () => {
  it("is equal to reduce + wrap for only pure results", () => {
    fc.assert(
      fc.property(fc.array(fc.string()), (strs: string[]) => {
        expect(
          simplify(Maybe.reduceM((state, str) => Maybe.Just(state.concat(str)), "", strs)),
        ).toEqual(simplify(Maybe.Just(strs.reduce((state, str) => state.concat(str), ""))));
      }),
    );
  });
  it("is equal to Nothing for any empty results", () => {
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
              Maybe.reduceM(
                (state, str) =>
                  predicate(str) ? Maybe.Just(state.concat(str[0])) : Maybe.Nothing(),
                "",
                strs,
              ),
            ),
          ).toEqual(simplify(Maybe.Nothing()));
        },
      ),
    );
  });
});

describe("sequence", () => {
  it("is equal to wrap for only pure results", () => {
    fc.assert(
      fc.property(fc.array(fc.string()), (strs: string[]) => {
        expect(simplify(Maybe.sequence(strs.map(Maybe.Just)))).toEqual(simplify(Maybe.Just(strs)));
      }),
    );
  });
  it("is equal to Nothing for any empty results", () => {
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
              Maybe.sequence(
                strs.map(str => (predicate(str) ? Maybe.Just(str[0]) : Maybe.Nothing())),
              ),
            ),
          ).toEqual(simplify(Maybe.Nothing()));
        },
      ),
    );
  });
});

describe("toMaybe", () => {
  it("produces Nothing for null", () => {
    expect(simplify(Maybe.toMaybe(null))).toEqual(simplify(Maybe.Nothing()));
  });
  it("produces Nothing for undefined", () => {
    expect(simplify(Maybe.toMaybe(undefined))).toEqual(simplify(Maybe.Nothing()));
  });
  it("produces a value for values", () => {
    fc.assert(
      fc.property(fc.integer(), (n: number) =>
        expect(simplify(Maybe.toMaybe(n))).toEqual(simplify(Maybe.Just(n))),
      ),
    );
  });
});

describe("unless", () => {
  it("Just [] for false", () => {
    expect(simplify(Maybe.unless(false))).toEqual(simplify(Maybe.Just(undefined)));
  });
  it("Nothing for true", () => {
    expect(simplify(Maybe.unless(true))).toEqual(simplify(Maybe.Nothing()));
  });
});

describe("when", () => {
  it("Just [] for true", () => {
    expect(simplify(Maybe.when(true))).toEqual(simplify(Maybe.Just(undefined)));
  });
  it("Nothing for false", () => {
    expect(simplify(Maybe.when(false))).toEqual(simplify(Maybe.Nothing()));
  });
});

describe("zipWithM", () => {
  it("is equal to zipWith + wrap for only pure results", () => {
    fc.assert(
      fc.property(fc.array(fc.string()), fc.array(fc.integer()), (strs: string[], ns: number[]) => {
        expect(simplify(Maybe.zipWithM((str, n) => Maybe.Just(str.length + n), strs, ns))).toEqual(
          simplify(Maybe.Just(strs.zipWith((str, n) => str.length + n, ns))),
        );
      }),
    );
  });
  it("is equal to Nothing for any empty results", () => {
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
            Maybe.zipWithM(
              ([str, i], n) => (predicate(i) ? Maybe.Just(str.length + n) : Maybe.Nothing()),
              strs,
              ns,
            ),
          ),
        ).toEqual(simplify(Maybe.Nothing()));
      }),
    );
  });
});

describe("IMaybe", () => {
  it("obeys the left identity monad law", () => {
    const k = (s: string) =>
      Maybe.Just(s)
        .filter(x => x.length < 4)
        .map(x => x.length);
    fc.assert(
      fc.property(fc.string(), s => {
        expect(simplify(Maybe.Just(s).chain(k))).toEqual(simplify(k(s)));
      }),
    );
  });

  it("obeys the right identity monad law", () => {
    fc.assert(
      fc.property(fc.oneof(fc.constant(Maybe.Nothing()), fc.string().map(Maybe.Just)), m => {
        expect(simplify(m.chain(Maybe.Just))).toEqual(simplify(m));
      }),
    );
  });

  it("obeys the right monad associativity law", () => {
    const k = (s: string) =>
      Maybe.Just(s)
        .filter(x => x.length < 4)
        .map(x => x.length);
    const h = (n: number) =>
      Maybe.Just(n)
        .filter(x => x % 2 === 0)
        .map(x => x.toString());

    fc.assert(
      fc.property(
        fc.oneof(fc.constant(Maybe.Nothing<string>()), fc.string().map(Maybe.Just)),
        m => {
          expect(simplify(m.chain(x => k(x).chain(h)))).toEqual(simplify(m.chain(k).chain(h)));
        },
      ),
    );
  });

  describe("defaultWith", () => {
    it("Returns payload when present", () => {
      fc.assert(
        fc.property(fc.string(), s => {
          expect(Maybe.Just(s).defaultWith("foo")).toEqual(s);
        }),
      );
    });
    it("Returns default when empty", () => {
      expect(Maybe.Nothing().defaultWith("foo")).toEqual("foo");
    });
  });

  describe("filter", () => {
    it("Passes the value into predicate", () => {
      fc.assert(
        fc.property(fc.string(), s => {
          // @ts-ignore
          Maybe.Just(s).filter(x => expect(x).toEqual(s));
        }),
      );
    });
    it("Erases the value when the predicate returns false", () => {
      fc.assert(
        fc.property(fc.string(), s => {
          expect(simplify(Maybe.Just(s).filter(constant(false)))).toEqual(
            simplify(Maybe.Nothing()),
          );
        }),
      );
    });
    it("Leaves the value when the predicate returns true", () => {
      fc.assert(
        fc.property(fc.string(), s => {
          expect(simplify(Maybe.Just(s).filter(constant(true)))).toEqual(simplify(Maybe.Just(s)));
        }),
      );
    });
    it("Does not affect empty values", () => {
      fc.assert(
        fc.property(fc.boolean(), b => {
          expect(simplify(Maybe.Nothing().filter(constant(b)))).toEqual(simplify(Maybe.Nothing()));
        }),
      );
    });
  });

  describe("chain", () => {
    it("Passes the payload to the callback", () => {
      fc.assert(
        fc.property(fc.string(), s => {
          Maybe.Just(s).chain(x => Maybe.Just(expect(x).toEqual(s)));
        }),
      );
    });
    it("Returns the value returned by the callback", () => {
      const k = (s: string) => Maybe.Just(s).filter(x => x.length < 5);
      fc.assert(
        fc.property(fc.string(), s => {
          expect(simplify(Maybe.Just(s).chain(k))).toEqual(simplify(k(s)));
        }),
      );
    });
    it("Skips the callback on empty", () => {
      const k = (s: string) => Maybe.Just(s).filter(x => x.length < 5);
      expect(simplify(Maybe.Nothing<string>().chain(k))).toEqual(simplify(Maybe.Nothing()));
    });
  });

  describe("isJust", () => {
    it("Returns true for Just(s)", () => {
      fc.assert(
        fc.property(fc.string(), s => {
          expect(simplify(Maybe.Just(s).isJust())).toEqual(true);
        }),
      );
    });
    it("Returns false for Nothing()", () => {
      expect(simplify(Maybe.Nothing().isJust())).toEqual(false);
    });
  });

  describe("isNothing", () => {
    it("Returns false for Just(s)", () => {
      fc.assert(
        fc.property(fc.string(), s => {
          expect(simplify(Maybe.Just(s).isNothing())).toEqual(false);
        }),
      );
    });
    it("Returns true for Nothing()", () => {
      expect(simplify(Maybe.Nothing().isNothing())).toEqual(true);
    });
  });

  describe("map", () => {
    it("Passes the payload to the callback", () => {
      fc.assert(
        fc.property(fc.string(), s => {
          Maybe.Just(s).map(x => expect(x).toEqual(s));
        }),
      );
    });
    it("Wraps the value returned by the callback", () => {
      const k = (s: string) => s.length;
      fc.assert(
        fc.property(fc.string(), s => {
          expect(simplify(Maybe.Just(s).map(k))).toEqual(simplify(Maybe.Just(k(s))));
        }),
      );
    });
    it("Skips the callback on empty", () => {
      const k = (s: string) => s.length;
      expect(simplify(Maybe.Nothing<string>().map(k))).toEqual(simplify(Maybe.Nothing()));
    });
  });

  describe("matchCase", () => {
    it("Passes the payload to the correct callback", () => {
      Maybe.Just("foo").matchCase({
        just: x => expect(x).toEqual("foo"),
        nothing: () => fail("Not expected to be called"),
      });
      Maybe.Nothing().matchCase({
        just: () => fail("Not expected to be called"),
        nothing: () => undefined,
      });
    });
    it("returns the correct value when a value is provided", () => {
      fc.assert(
        fc.property(fc.string(), s => {
          expect(
            Maybe.Just(s).matchCase({
              just: x => x.length,
              nothing: () => s.length - 1,
            }),
          ).toEqual(s.length);
        }),
      );
    });
    it("returns the correct value when no value is provided", () => {
      expect(Maybe.Nothing().matchCase({ just: () => 1, nothing: () => 0 })).toEqual(0);
    });
  });

  describe("or", () => {
    it("Picks the first if non empty", () => {
      expect(simplify(Maybe.Just("foo").or(Maybe.Just("bar")))).toEqual(
        simplify(Maybe.Just("foo")),
      );
    });
    it("Picks the second if first empty", () => {
      expect(simplify(Maybe.Nothing().or(Maybe.Just("bar")))).toEqual(simplify(Maybe.Just("bar")));
    });
    it("Picks nothing if both empty", () => {
      expect(simplify(Maybe.Nothing().or(Maybe.Nothing()))).toEqual(simplify(Maybe.Nothing()));
    });
  });

  describe("replace", () => {
    it("Returns something if both are non-empty", () => {
      expect(simplify(Maybe.Just("foo").replace(Maybe.Just("bar")))).toEqual(
        simplify(Maybe.Just("bar")),
      );
    });
    it("Returns nothing if the second is empty", () => {
      expect(simplify(Maybe.Just("foo").replace(Maybe.Nothing()))).toEqual(
        simplify(Maybe.Nothing()),
      );
    });
    it("Returns nothing if the first is empty", () => {
      expect(simplify(Maybe.Nothing().replace(Maybe.Just("bar")))).toEqual(
        simplify(Maybe.Nothing()),
      );
    });
    it("Returns nothing if both are empty", () => {
      expect(simplify(Maybe.Nothing().replace(Maybe.Nothing()))).toEqual(simplify(Maybe.Nothing()));
    });
  });

  describe("replacePure", () => {
    it("Replaces value if non-empty", () => {
      expect(simplify(Maybe.Just("foo").replacePure(2))).toEqual(simplify(Maybe.Just(2)));
    });
    it("Returns nothing if empty", () => {
      expect(simplify(Maybe.Nothing().replacePure(2))).toEqual(simplify(Maybe.Nothing()));
    });
  });

  describe("toArray", () => {
    it("Returns singleton array if non-empty", () => {
      expect(Maybe.Just("foo").toArray()).toEqual(["foo"]);
    });
    it("Returns empty array if empty", () => {
      expect(Maybe.Nothing().toArray()).toEqual([]);
    });
  });

  describe("toString", () => {
    it("Renders Nothing as Nothing", () => {
      expect(Maybe.Nothing().toString()).toEqual("Nothing");
    });
    it("Renders Just(s) as Just (s)", () => {
      expect(Maybe.Just("foo").toString()).toEqual("Just (foo)");
    });
  });

  describe("voidOut", () => {
    it("Returns Nothing for Nothing", () => {
      expect(simplify(Maybe.Nothing().voidOut())).toEqual(simplify(Maybe.Nothing()));
    });
    it("Renders Just(s) as Just (s)", () => {
      expect(simplify(Maybe.Just("foo").voidOut())).toEqual(simplify(Maybe.Just(undefined)));
    });
  });

  describe("unCons", () => {
    it("Returns Nothing for empty", () => {
      expect(simplify(Maybe.unCons([]))).toEqual(simplify(Maybe.Nothing()));
    });
    it("Returns a tuple for non empty", () => {
      fc.assert(
        fc.property(
          fc.array(fc.anything()).filter(arr => !arr.isEmpty()),
          arr => {
            expect(simplify(Maybe.unCons(arr))).toEqual(
              simplify(Maybe.Just([arr[0], arr.slice(1)])),
            );
          },
        ),
      );
    });
  });

  describe("dataToMaybe", () => {
    it("Returns Nothing when no match", () => {
      fc.assert(
        fc.property(
          fc
            .record({
              match: fc.string(),
              data: fc.record({
                tag: fc.string(),
                value: fc.anything(),
              }),
            })
            .filter(({ match, data }) => match !== data.tag),
          ({ match, data }) => {
            expect(simplify(Maybe.dataToMaybe(match, data))).toEqual(simplify(Maybe.Nothing()));
          },
        ),
      );
    });
    it("Returns Just when the tag matches", () => {
      fc.assert(
        fc.property(
          fc.record({
            tag: fc.string(),
            value: fc.anything(),
          }),
          data => {
            expect(simplify(Maybe.dataToMaybe(data.tag, data))).toEqual(
              simplify(Maybe.Just(data.value)),
            );
          },
        ),
      );
    });
  });
});
