import * as fc from "fast-check";
import { unzip } from "./array";
import * as M from "./maybe";
import { constant, prove, simplify } from "./prelude";
import { Equals } from "./utilityTypes";

/*------------------------------
  TYPE TESTS
  ------------------------------*/

// Map the fields of an object
type MapMaybeObject = Equals<
  M.MapMaybe<{ bar: number; baz: string }>,
  { bar: M.Maybe<number>; baz: M.Maybe<string> }
>;
prove<MapMaybeObject>("proof");

// Map the items of an array
type MapMaybeArray = Equals<M.MapMaybe<string[]>, Array<M.Maybe<string>>>;
prove<MapMaybeArray>("proof");

/*------------------------------
  UNIT TESTS
  ------------------------------*/

describe("arrayToMaybe", () => {
  it("returns nothing when input is empty", () => {
    expect(simplify(M.arrayToMaybe([]))).toEqual(simplify(M.Nothing()));
  });
  it("returns the first element when the input is not empty", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer()).filter(x => x.length > 0),
        (xs: number[]) => {
          expect(simplify(M.arrayToMaybe(xs))).toEqual(simplify(M.Just(xs[0])));
        }
      )
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
              M.build<Foo>({
                bar: M.Just(bar),
                baz: M.Just(baz),
                qux: M.Just(qux)
              })
            )
          ).toEqual(
            simplify(
              M.Just({
                bar,
                baz,
                qux
              })
            )
          );
        }
      )
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
          function getComponent<T>(i: number, value: T): M.Maybe<T> {
            return empties.find(x => x === i) != null
              ? M.Nothing()
              : M.Just(value);
          }
          expect(
            simplify(
              M.build<Foo>({
                bar: getComponent(0, bar),
                baz: getComponent(1, baz),
                qux: getComponent(2, qux)
              })
            )
          ).toEqual(simplify(M.Nothing()));
        }
      )
    );
  });
});

describe("catMaybes", () => {
  it("returns every Maybe with a value", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(fc.constant(M.Nothing<number>()), fc.integer().map(M.Just))
        ),
        (xs: Array<M.Maybe<number>>) => {
          expect(M.catMaybes(xs)).toEqual(
            xs.filter(x => x.isJust()).map(x => (x as any).value)
          );
        }
      )
    );
  });
});

describe("mapM and forM", () => {
  it("is equal to map + wrap for only pure results", () => {
    fc.assert(
      fc.property(fc.array(fc.integer()), (xs: number[]) => {
        const resultForM = simplify(M.forM(xs, x => M.Just(x.toString())));
        const resultMapM = simplify(M.mapM(x => M.Just(x.toString()), xs));
        expect(resultForM).toEqual(resultMapM);
        expect(resultMapM).toEqual(simplify(M.Just(xs.map(x => x.toString()))));
      })
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
              .map(empties => [size, empties] as [number, number[]])
          ),
        ([size, empties]) => {
          const input = [];

          for (let i = 0; i < size; i++) {
            input.push(i);
          }

          const mapping = (i: number) =>
            empties.find(x => x === i) != null
              ? M.Nothing<string>()
              : M.Just(i.toString());

          const resultForM = simplify(M.forM(input, mapping));
          const resultMapM = simplify(M.mapM(mapping, input));
          expect(resultForM).toEqual(resultMapM);
          expect(resultMapM).toEqual(simplify(M.Nothing()));
        }
      )
    );
  });
});

describe("join", () => {
  it("equals Nothing when outer is empty", () => {
    expect(simplify(M.join(M.Nothing()))).toEqual(simplify(M.Nothing()));
  });
  it("equals Nothing when inner is empty", () => {
    expect(simplify(M.join(M.Just(M.Nothing())))).toEqual(
      simplify(M.Nothing())
    );
  });
  it("equals inner when both levels non-empty", () => {
    expect(simplify(M.join(M.Just(M.Just(12))))).toEqual(simplify(M.Just(12)));
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
          expect(simplify(M.lift(f, M.Just(a), M.Just(b), M.Just(c)))).toEqual(
            simplify(M.Just(f(a, b, c)))
          );
        }
      )
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
          function getArg<T>(i: number, value: T): M.Maybe<T> {
            return empties.find(x => x === i) != null
              ? M.Nothing()
              : M.Just(value);
          }

          expect(
            simplify(M.lift(f, getArg(0, a), getArg(1, b), getArg(2, c)))
          ).toEqual(simplify(M.Nothing()));
        }
      )
    );
  });
});

describe("mapAndUnzipWith", () => {
  it("is equal to map + unzip + wrap for only pure results", () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.integer(), fc.string())),
        (xys: Array<[number, string]>) => {
          expect(
            simplify(
              M.mapAndUnzipWith(
                ([x, y]) => M.Just<[string, number]>([y, x]),
                xys
              )
            )
          ).toEqual(
            simplify(
              M.Just(unzip(xys.map(([x, y]) => [y, x] as [string, number])))
            )
          );
        }
      )
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
              .map(
                empties => [xys, empties] as [Array<[number, string]>, number[]]
              )
          ),
        ([xys, empties]) => {
          expect(
            simplify(
              M.mapAndUnzipWith(
                ([[x, y], i]) =>
                  empties.find(e => e === i) != null
                    ? M.Nothing<[string, number]>()
                    : M.Just<[string, number]>([y, x]),
                xys.map((xy, i) => [xy, i] as [[number, string], number])
              )
            )
          ).toEqual(simplify(M.Nothing()));
        }
      )
    );
  });
});

describe("mapMaybe", () => {
  it("is equal to map for only pure results", () => {
    fc.assert(
      fc.property(fc.array(fc.string()), (strs: string[]) => {
        expect(M.mapMaybe(str => M.Just(str.length), strs)).toEqual(
          strs.map(str => str.length)
        );
      })
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
                  [strs.map((s, i) => [s, i]), empties] as [
                    Array<[string, number]>,
                    number[]
                  ]
              )
          ),
        ([strs, empties]) => {
          const predicate = ([s, i]: [string, number]) =>
            empties.find(x => x === i) == null;
          expect(
            M.mapMaybe(
              str => (predicate(str) ? M.Just(str.length) : M.Nothing()),
              strs
            )
          ).toEqual(strs.filter(predicate).map(str => str.length));
        }
      )
    );
  });
});

describe("reduceM", () => {
  it("is equal to reduce + wrap for only pure results", () => {
    fc.assert(
      fc.property(fc.array(fc.string()), (strs: string[]) => {
        expect(
          simplify(
            M.reduceM((state, str) => M.Just(state.concat(str)), "", strs)
          )
        ).toEqual(
          simplify(M.Just(strs.reduce((state, str) => state.concat(str), "")))
        );
      })
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
                  [strs.map((s, i) => [s, i]), empties] as [
                    Array<[string, number]>,
                    number[]
                  ]
              )
          ),
        ([strs, empties]) => {
          const predicate = ([s, i]: [string, number]) =>
            empties.find(x => x === i) == null;
          expect(
            simplify(
              M.reduceM(
                (state, str) =>
                  predicate(str) ? M.Just(state.concat(str[0])) : M.Nothing(),
                "",
                strs
              )
            )
          ).toEqual(simplify(M.Nothing()));
        }
      )
    );
  });
});

describe("sequence", () => {
  it("is equal to wrap for only pure results", () => {
    fc.assert(
      fc.property(fc.array(fc.string()), (strs: string[]) => {
        expect(simplify(M.sequence(strs.map(M.Just)))).toEqual(
          simplify(M.Just(strs))
        );
      })
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
                  [strs.map((s, i) => [s, i]), empties] as [
                    Array<[string, number]>,
                    number[]
                  ]
              )
          ),
        ([strs, empties]) => {
          const predicate = ([s, i]: [string, number]) =>
            empties.find(x => x === i) == null;
          expect(
            simplify(
              M.sequence(
                strs.map(str => (predicate(str) ? M.Just(str[0]) : M.Nothing()))
              )
            )
          ).toEqual(simplify(M.Nothing()));
        }
      )
    );
  });
});

describe("toMaybe", () => {
  it("produces Nothing for null", () => {
    expect(simplify(M.toMaybe(null))).toEqual(simplify(M.Nothing()));
  });
  it("produces Nothing for undefined", () => {
    expect(simplify(M.toMaybe(undefined))).toEqual(simplify(M.Nothing()));
  });
  it("produces a value for values", () => {
    fc.assert(
      fc.property(fc.integer(), (n: number) =>
        expect(simplify(M.toMaybe(n))).toEqual(simplify(M.Just(n)))
      )
    );
  });
});

describe("unless", () => {
  it("Just [] for false", () => {
    expect(simplify(M.unless(false))).toEqual(simplify(M.Just([])));
  });
  it("Nothing for true", () => {
    expect(simplify(M.unless(true))).toEqual(simplify(M.Nothing()));
  });
});

describe("when", () => {
  it("Just [] for true", () => {
    expect(simplify(M.when(true))).toEqual(simplify(M.Just([])));
  });
  it("Nothing for false", () => {
    expect(simplify(M.when(false))).toEqual(simplify(M.Nothing()));
  });
});

describe("zipWithM", () => {
  it("is equal to zipWith + wrap for only pure results", () => {
    fc.assert(
      fc.property(
        fc.array(fc.string()),
        fc.array(fc.integer()),
        (strs: string[], ns: number[]) => {
          expect(
            simplify(M.zipWithM((str, n) => M.Just(str.length + n), strs, ns))
          ).toEqual(
            simplify(M.Just(strs.zipWith((str, n) => str.length + n, ns)))
          );
        }
      )
    );
  });
  it("is equal to Nothing for any empty results", () => {
    const arb = fc
      .array(fc.string(), 1, 10)
      .chain(strs =>
        fc
          .array(fc.integer(), 1, 10)
          .map(
            ns =>
              [strs.map((s, i) => [s, i]), ns] as [
                Array<[string, number]>,
                number[]
              ]
          )
      )
      .chain(([strs, ns]) => {
        const size = Math.min(strs.length, ns.length);
        return fc
          .array(fc.integer(0, size - 1), 1, size)
          .map(
            empties =>
              [strs, ns, empties] as [
                Array<[string, number]>,
                number[],
                number[]
              ]
          );
      });

    fc.assert(
      fc.property(arb, ([strs, ns, empties]) => {
        const predicate = (i: number) => empties.find(x => x === i) == null;
        expect(
          simplify(
            M.zipWithM(
              ([str, i], n) =>
                predicate(i) ? M.Just(str.length + n) : M.Nothing(),
              strs,
              ns
            )
          )
        ).toEqual(simplify(M.Nothing()));
      })
    );
  });
});

describe("IMaybe", () => {
  it("obeys the left identity monad law", () => {
    const k = (s: string) =>
      M.Just(s)
        .filter(x => x.length < 4)
        .map(x => x.length);
    fc.assert(
      fc.property(fc.string(), s => {
        expect(simplify(M.Just(s).chain(k))).toEqual(simplify(k(s)));
      })
    );
  });

  it("obeys the right identity monad law", () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constant(M.Nothing()), fc.string().map(M.Just)),
        m => {
          expect(simplify(m.chain(M.Just))).toEqual(simplify(m));
        }
      )
    );
  });

  it("obeys the right monad associativity law", () => {
    const k = (s: string) =>
      M.Just(s)
        .filter(x => x.length < 4)
        .map(x => x.length);
    const h = (n: number) =>
      M.Just(n)
        .filter(x => x % 2 === 0)
        .map(x => x.toString());

    fc.assert(
      fc.property(
        fc.oneof(fc.constant(M.Nothing<string>()), fc.string().map(M.Just)),
        m => {
          expect(simplify(m.chain(x => k(x).chain(h)))).toEqual(
            simplify(m.chain(k).chain(h))
          );
        }
      )
    );
  });

  describe("defaultWith", () => {
    it("Returns payload when present", () => {
      fc.assert(
        fc.property(fc.string(), s => {
          expect(M.Just(s).defaultWith("foo")).toEqual(s);
        })
      );
    });
    it("Returns default when empty", () => {
      expect(M.Nothing().defaultWith("foo")).toEqual("foo");
    });
  });

  describe("filter", () => {
    it("Passes the value into predicate", () => {
      fc.assert(
        fc.property(fc.string(), s => {
          M.Just(s).filter(x => !!expect(x).toEqual(s));
        })
      );
    });
    it("Erases the value when the predicate returns false", () => {
      fc.assert(
        fc.property(fc.string(), s => {
          expect(simplify(M.Just(s).filter(constant(false)))).toEqual(
            simplify(M.Nothing())
          );
        })
      );
    });
    it("Leaves the value when the predicate returns true", () => {
      fc.assert(
        fc.property(fc.string(), s => {
          expect(simplify(M.Just(s).filter(constant(true)))).toEqual(
            simplify(M.Just(s))
          );
        })
      );
    });
    it("Does not affect empty values", () => {
      fc.assert(
        fc.property(fc.boolean(), b => {
          expect(simplify(M.Nothing().filter(constant(b)))).toEqual(
            simplify(M.Nothing())
          );
        })
      );
    });
  });

  describe("chain", () => {
    it("Passes the payload to the callback", () => {
      fc.assert(
        fc.property(fc.string(), s => {
          M.Just(s).chain(x => M.Just(expect(x).toEqual(s)));
        })
      );
    });
    it("Returns the value returned by the callback", () => {
      const k = (s: string) => M.Just(s).filter(x => x.length < 5);
      fc.assert(
        fc.property(fc.string(), s => {
          expect(simplify(M.Just(s).chain(k))).toEqual(simplify(k(s)));
        })
      );
    });
    it("Skips the callback on empty", () => {
      const k = (s: string) => M.Just(s).filter(x => x.length < 5);
      expect(simplify(M.Nothing<string>().chain(k))).toEqual(
        simplify(M.Nothing())
      );
    });
  });

  describe("isJust", () => {
    it("Returns true for Just(s)", () => {
      fc.assert(
        fc.property(fc.string(), s => {
          expect(simplify(M.Just(s).isJust())).toEqual(true);
        })
      );
    });
    it("Returns false for Nothing()", () => {
      expect(simplify(M.Nothing().isJust())).toEqual(false);
    });
  });

  describe("isNothing", () => {
    it("Returns false for Just(s)", () => {
      fc.assert(
        fc.property(fc.string(), s => {
          expect(simplify(M.Just(s).isNothing())).toEqual(false);
        })
      );
    });
    it("Returns true for Nothing()", () => {
      expect(simplify(M.Nothing().isNothing())).toEqual(true);
    });
  });

  describe("map", () => {
    it("Passes the payload to the callback", () => {
      fc.assert(
        fc.property(fc.string(), s => {
          M.Just(s).map(x => expect(x).toEqual(s));
        })
      );
    });
    it("Wraps the value returned by the callback", () => {
      const k = (s: string) => s.length;
      fc.assert(
        fc.property(fc.string(), s => {
          expect(simplify(M.Just(s).map(k))).toEqual(simplify(M.Just(k(s))));
        })
      );
    });
    it("Skips the callback on empty", () => {
      const k = (s: string) => s.length;
      expect(simplify(M.Nothing<string>().map(k))).toEqual(
        simplify(M.Nothing())
      );
    });
  });

  describe("matchCase", () => {
    it("Passes the payload to the correct callback", () => {
      M.Just("foo").matchCase({
        just: x => expect(x).toEqual("foo"),
        nothing: () => fail("Not expected to be called")
      });
      M.Nothing().matchCase({
        just: () => fail("Not expected to be called"),
        nothing: () => undefined
      });
    });
    it("returns the correct value when a value is provided", () => {
      fc.assert(
        fc.property(fc.string(), s => {
          expect(
            M.Just(s).matchCase({
              just: x => x.length,
              nothing: () => s.length - 1
            })
          ).toEqual(s.length);
        })
      );
    });
    it("returns the correct value when no value is provided", () => {
      expect(
        M.Nothing().matchCase({ just: () => 1, nothing: () => 0 })
      ).toEqual(0);
    });
  });

  describe("or", () => {
    it("Picks the first if non empty", () => {
      expect(simplify(M.Just("foo").or(M.Just("bar")))).toEqual(
        simplify(M.Just("foo"))
      );
    });
    it("Picks the second if first empty", () => {
      expect(simplify(M.Nothing().or(M.Just("bar")))).toEqual(
        simplify(M.Just("bar"))
      );
    });
    it("Picks nothing if both empty", () => {
      expect(simplify(M.Nothing().or(M.Nothing()))).toEqual(
        simplify(M.Nothing())
      );
    });
  });

  describe("replace", () => {
    it("Returns something if both are non-empty", () => {
      expect(simplify(M.Just("foo").replace(M.Just("bar")))).toEqual(
        simplify(M.Just("bar"))
      );
    });
    it("Returns nothing if the second is empty", () => {
      expect(simplify(M.Just("foo").replace(M.Nothing()))).toEqual(
        simplify(M.Nothing())
      );
    });
    it("Returns nothing if the first is empty", () => {
      expect(simplify(M.Nothing().replace(M.Just("bar")))).toEqual(
        simplify(M.Nothing())
      );
    });
    it("Returns nothing if both are empty", () => {
      expect(simplify(M.Nothing().replace(M.Nothing()))).toEqual(
        simplify(M.Nothing())
      );
    });
  });

  describe("replacePure", () => {
    it("Replaces value if non-empty", () => {
      expect(simplify(M.Just("foo").replacePure(2))).toEqual(
        simplify(M.Just(2))
      );
    });
    it("Returns nothing if empty", () => {
      expect(simplify(M.Nothing().replacePure(2))).toEqual(
        simplify(M.Nothing())
      );
    });
  });

  describe("toArray", () => {
    it("Returns singleton array if non-empty", () => {
      expect(M.Just("foo").toArray()).toEqual(["foo"]);
    });
    it("Returns empty array if empty", () => {
      expect(M.Nothing().toArray()).toEqual([]);
    });
  });

  describe("toString", () => {
    it("Renders Nothing as Nothing", () => {
      expect(M.Nothing().toString()).toEqual("Nothing");
    });
    it("Renders Just(s) as Just (s)", () => {
      expect(M.Just("foo").toString()).toEqual("Just (foo)");
    });
  });

  describe("voidOut", () => {
    it("Returns Nothing for Nothing", () => {
      expect(simplify(M.Nothing().voidOut())).toEqual(simplify(M.Nothing()));
    });
    it("Renders Just(s) as Just (s)", () => {
      expect(simplify(M.Just("foo").voidOut())).toEqual(simplify(M.Just([])));
    });
  });
});
