import * as fc from "fast-check";
import { Maybe } from "../src";
import { constant, simplify } from "../src/prelude";

/*------------------------------
  UNIT TESTS
  ------------------------------*/

describe("fromArray", () => {
  it("returns nothing when input is empty", () => {
    expect(simplify(Maybe.fromArray([]))).toEqual(simplify(Maybe.Nothing()));
  });
  it("returns the first element when the input is not empty", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer()).filter(x => x.length > 0),
        (xs: number[]) => {
          expect(simplify(Maybe.fromArray(xs))).toEqual(simplify(Maybe.Just(xs[0])));
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
            xs.filter(x => x.isJust).map(x => (x as any).data.value),
          );
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
          const predicate = ([, i]: [string, number]) => empties.find(x => x === i) === undefined;
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
          const predicate = ([, i]: [string, number]) => empties.find(x => x === i) === undefined;
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

describe("fromJS", () => {
  it("produces Nothing for null", () => {
    expect(simplify(Maybe.fromJS(null))).toEqual(simplify(Maybe.Nothing()));
  });
  it("produces Nothing for undefined", () => {
    expect(simplify(Maybe.fromJS(undefined))).toEqual(simplify(Maybe.Nothing()));
  });
  it("produces a value for values", () => {
    fc.assert(
      fc.property(fc.integer(), (n: number) =>
        expect(simplify(Maybe.fromJS(n))).toEqual(simplify(Maybe.Just(n))),
      ),
    );
  });
});

describe("Maybe", () => {
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
          expect(simplify(Maybe.Just(s).isJust)).toEqual(true);
        }),
      );
    });
    it("Returns false for Nothing()", () => {
      expect(simplify(Maybe.Nothing().isJust)).toEqual(false);
    });
  });

  describe("isNothing", () => {
    it("Returns false for Just(s)", () => {
      fc.assert(
        fc.property(fc.string(), s => {
          expect(simplify(Maybe.Just(s).isNothing)).toEqual(false);
        }),
      );
    });
    it("Returns true for Nothing()", () => {
      expect(simplify(Maybe.Nothing().isNothing)).toEqual(true);
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
        Just: x => expect(x).toEqual("foo"),
        Nothing: () => fail("Not expected to be called"),
      });
      Maybe.Nothing().matchCase({
        Just: () => fail("Not expected to be called"),
        Nothing: () => undefined,
      });
    });
    it("returns the correct value when a value is provided", () => {
      fc.assert(
        fc.property(fc.string(), s => {
          expect(
            Maybe.Just(s).matchCase({
              Just: x => x.length,
              Nothing: () => s.length - 1,
            }),
          ).toEqual(s.length);
        }),
      );
    });
    it("returns the correct value when no value is provided", () => {
      expect(Maybe.Nothing().matchCase({ Just: () => 1, Nothing: () => 0 })).toEqual(0);
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
      expect(
        Maybe.Just("foo")
          .voidOut()
          .toJSON(),
      ).toBeUndefined();
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

  describe("valueEquals", () => {
    it("Returns false if either are Nothing", () => {
      expect(Maybe.Just(1).valueEquals(Maybe.Nothing())).toEqual(false);
      expect(Maybe.Nothing().valueEquals(Maybe.Just(1))).toEqual(false);
      expect(Maybe.Nothing().valueEquals(Maybe.Nothing())).toEqual(false);
    });
    it("Returns true if equal", () => {
      expect(Maybe.Just(1).valueEquals(Maybe.Just(1))).toEqual(true);
    });
    it("Returns false if not equal", () => {
      expect(Maybe.Just(1).valueEquals(Maybe.Just(0))).toEqual(false);
    });
    it("Returns equality check result if predicate specified", () => {
      expect(Maybe.Just(1).valueEquals(Maybe.Just(0), () => true)).toEqual(true);
      expect(Maybe.Just(1).valueEquals(Maybe.Just(1), () => false)).toEqual(false);
    });
  });

  describe("valueEqualsPure", () => {
    it("Returns false if Nothing", () => {
      expect(Maybe.Nothing().valueEqualsPure(1)).toEqual(false);
    });
    it("Returns true if equal", () => {
      expect(Maybe.Just(1).valueEqualsPure(1)).toEqual(true);
    });
    it("Returns false if not equal", () => {
      expect(Maybe.Just(1).valueEqualsPure(0)).toEqual(false);
    });
    it("Returns equality check result if predicate specified", () => {
      expect(Maybe.Just(1).valueEqualsPure(0, () => true)).toEqual(true);
      expect(Maybe.Just(1).valueEqualsPure(1, () => false)).toEqual(false);
    });
  });

  describe("fromData", () => {
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
            expect(simplify(Maybe.fromData(data, match))).toEqual(simplify(Maybe.Nothing()));
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
            expect(simplify(Maybe.fromData(data, data.tag))).toEqual(
              simplify(Maybe.Just(data.value)),
            );
          },
        ),
      );
    });
  });
});
