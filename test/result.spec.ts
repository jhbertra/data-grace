import * as fc from "fast-check";
import { Result, Maybe } from "../src";
import { simplify } from "../src/prelude";

/*------------------------------
  UNIT TESTS
  ------------------------------*/

describe("fromArray", () => {
  it("returns an error when input is empty", () => {
    expect(simplify(Result.fromArray([], "error"))).toEqual(simplify(Result.Error("error")));
  });
  it("returns the first element when the input is not empty", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer()).filter(x => x.length > 0),
        (xs: number[]) => {
          expect(simplify(Result.fromArray(xs, "error"))).toEqual(simplify(Result.Ok(xs[0])));
        },
      ),
    );
  });
});

describe("fromMaybe", () => {
  it("returns an error when input is empty", () => {
    expect(simplify(Result.fromMaybe(Maybe.Nothing(), "error"))).toEqual(
      simplify(Result.Error("error")),
    );
  });
  it("returns the value when the input is not empty", () => {
    fc.assert(
      fc.property(fc.anything(), a => {
        expect(simplify(Result.fromMaybe(Maybe.Just(a), "error"))).toEqual(simplify(Result.Ok(a)));
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
              Result.record<Foo, string>({
                bar: Result.Ok(bar),
                baz: Result.Ok(baz),
                qux: Result.Ok(qux),
              }),
            ),
          ).toEqual(
            simplify(
              Result.Ok({
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
  it("equals Error when any components have no value", () => {
    fc.assert(
      fc.property(
        fc.float(),
        fc.boolean(),
        fc.string(),
        fc.array(fc.integer(0, 2), 1, 3),
        (bar: number, baz: boolean, qux: string, empties: number[]) => {
          function getComponent<T>(i: number, value: T): Result<T, number> {
            return empties.find(x => x === i) !== undefined ? Result.Error(i) : Result.Ok(value);
          }
          expect(
            simplify(
              Result.record<Foo, number>({
                bar: getComponent(0, bar),
                baz: getComponent(1, baz),
                qux: getComponent(2, qux),
              }),
            ),
          ).toEqual(simplify(Result.Error(empties.reduce((x, y) => Math.min(x, y), 2))));
        },
      ),
    );
  });
});

describe("errors", () => {
  it("returns the value of every Error", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            fc.string().map(x => Result.Error<number, string>(x)),
            fc.integer().map(x => Result.Ok<number, string>(x)),
          ),
        ),
        (xs: Array<Result<number, string>>) => {
          expect(Result.errors(xs)).toEqual(
            xs.filter(x => x.isError).map(x => (x as any).data.value),
          );
        },
      ),
    );
  });
});

describe("oks", () => {
  it("returns the value of every Error", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            fc.string().map(x => Result.Error<number, string>(x)),
            fc.integer().map(x => Result.Ok<number, string>(x)),
          ),
        ),
        (xs: Array<Result<number, string>>) => {
          expect(Result.oks(xs)).toEqual(xs.filter(x => x.isOk).map(x => (x as any).data.value));
        },
      ),
    );
  });
});

describe("sequence", () => {
  it("is equal to wrap for only Ok results", () => {
    fc.assert(
      fc.property(fc.array(fc.string()), (strs: string[]) => {
        expect(simplify(Result.sequence(strs.map(Result.Ok)))).toEqual(simplify(Result.Ok(strs)));
      }),
    );
  });
  it("is equal to Error for any Error results", () => {
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
              Result.sequence(
                strs.map(str => (predicate(str) ? Result.Ok(str[0]) : Result.Error(str[1]))),
              ),
            ),
          ).toEqual(simplify(Result.Error(empties.reduce((x, y) => Math.min(x, y), strs.length))));
        },
      ),
    );
  });
});

describe("Result", () => {
  it("obeys the left identity monad law", () => {
    const k = (s: string) => (s.length < 4 ? Result.Ok(s.length) : Result.Error("error"));
    fc.assert(
      fc.property(fc.string(), s => {
        expect(simplify(Result.Ok(s).chain(k))).toEqual(simplify(k(s)));
      }),
    );
  });

  it("obeys the right identity monad law", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.string().map(x => Result.Error<string, string>(x)),
          fc.string().map(x => Result.Ok<string, string>(x)),
        ),
        m => {
          expect(simplify(m.chain(Result.Ok))).toEqual(simplify(m));
        },
      ),
    );
  });

  it("obeys the right monad associativity law", () => {
    const k = (s: string) =>
      s.length < 4 ? Result.Ok<number, string>(s.length) : Result.Error<number, string>("error1");
    const h = (n: number) =>
      n % 2 === 0
        ? Result.Ok<string, string>(n.toString())
        : Result.Error<string, string>("error2");

    fc.assert(
      fc.property(
        fc.oneof(
          fc.string().map(x => Result.Error<string, string>(x)),
          fc.string().map(x => Result.Ok<string, string>(x)),
        ),
        m => {
          expect(simplify(m.chain(x => k(x).chain(h)))).toEqual(simplify(m.chain(k).chain(h)));
        },
      ),
    );
  });

  describe("defaultErrorWith", () => {
    it("Returns default when Ok", () => {
      fc.assert(
        fc.property(fc.string(), s => {
          expect(Result.Ok(s).defaultErrorWith("foo")).toEqual("foo");
        }),
      );
    });
    it("Returns payload when Error", () => {
      fc.assert(
        fc.property(fc.string(), s => {
          expect(Result.Error(s).defaultErrorWith("foo")).toEqual(s);
        }),
      );
    });
  });

  describe("defaultWith", () => {
    it("Returns default when Error", () => {
      fc.assert(
        fc.property(fc.string(), s => {
          expect(Result.Error(s).defaultWith("foo")).toEqual("foo");
        }),
      );
    });
    it("Returns payload when Ok", () => {
      fc.assert(
        fc.property(fc.string(), s => {
          expect(Result.Ok(s).defaultWith("foo")).toEqual(s);
        }),
      );
    });
  });

  describe("chain", () => {
    it("Passes the payload to the callback", () => {
      fc.assert(
        fc.property(fc.string(), s => {
          Result.Ok(s).chain(x => Result.Ok(expect(x).toEqual(s)));
        }),
      );
    });
    it("Returns the value returned by the callback", () => {
      const k = (s: string) =>
        s.length < 5 ? Result.Ok<string, string>(s) : Result.Error<string, string>("error");
      fc.assert(
        fc.property(fc.string(), s => {
          expect(simplify(Result.Ok(s).chain(k))).toEqual(simplify(k(s)));
        }),
      );
    });
    it("Skips the callback on empty", () => {
      const k = (s: string) =>
        s.length < 5 ? Result.Ok<string, string>(s) : Result.Error<string, string>("error");
      expect(simplify(Result.Error<string, string>("error").chain(k))).toEqual(
        simplify(Result.Error("error")),
      );
    });
  });

  describe("isRight", () => {
    it("Returns true for Ok(s)", () => {
      fc.assert(
        fc.property(fc.string(), s => {
          expect(simplify(Result.Ok(s).isOk)).toEqual(true);
        }),
      );
    });
    it("Returns false for Error(s)", () => {
      fc.assert(
        fc.property(fc.string(), s => {
          expect(simplify(Result.Error(s).isOk)).toEqual(false);
        }),
      );
    });
  });

  describe("isLeft", () => {
    it("Returns false for Ok(s)", () => {
      fc.assert(
        fc.property(fc.string(), s => {
          expect(simplify(Result.Ok(s).isError)).toEqual(false);
        }),
      );
    });
    it("Returns true for Error(s)", () => {
      fc.assert(
        fc.property(fc.string(), s => {
          expect(simplify(Result.Error(s).isError)).toEqual(true);
        }),
      );
    });
  });

  describe("map", () => {
    it("Passes the payload to the callback", () => {
      fc.assert(
        fc.property(fc.string(), s => {
          Result.Ok(s).map(x => expect(x).toEqual(s));
        }),
      );
    });
    it("Wraps the value returned by the callback", () => {
      const k = (s: string) => s.length;
      fc.assert(
        fc.property(fc.string(), s => {
          expect(simplify(Result.Ok(s).map(k))).toEqual(simplify(Result.Ok(k(s))));
        }),
      );
    });
    it("Skips the callback on empty", () => {
      const k = (s: string) => s.length;
      expect(simplify(Result.Error<string, string>("error").map(k))).toEqual(
        simplify(Result.Error("error")),
      );
    });
  });

  describe("mapError", () => {
    it("Passes the payload to the callback", () => {
      fc.assert(
        fc.property(fc.string(), s => {
          Result.Error(s).mapError(x => expect(x).toEqual(s));
        }),
      );
    });
    it("Wraps the value returned by the callback", () => {
      const k = (s: string) => s.length;
      fc.assert(
        fc.property(fc.string(), s => {
          expect(simplify(Result.Error(s).mapError(k))).toEqual(simplify(Result.Error(k(s))));
        }),
      );
    });
    it("Skips the callback on empty", () => {
      const k = (s: string) => s.length;
      expect(simplify(Result.Ok<string, string>("foo").mapError(k))).toEqual(
        simplify(Result.Ok("foo")),
      );
    });
  });

  describe("matchCase", () => {
    it("Passes the payload to the correct callback", () => {
      Result.Ok("foo").matchCase({
        Error: () => fail("Not expected to be called"),
        Ok: x => expect(x).toEqual("foo"),
      });
      Result.Error("foo").matchCase({
        Error: x => expect(x).toEqual("foo"),
        Ok: () => fail("Not expected to be called"),
      });
    });
    it("returns the correct value when a Ok is provided", () => {
      fc.assert(
        fc.property(fc.string(), s => {
          expect(
            Result.Ok<string, string>(s).matchCase({
              Ok: x => x.length,
              Error: x => x.length - 1,
            }),
          ).toEqual(s.length);
        }),
      );
    });
    it("returns the correct value when a Error is provided", () => {
      fc.assert(
        fc.property(fc.string(), s => {
          expect(
            Result.Error<string, string>(s).matchCase({
              Ok: x => x.length,
              Error: () => s.length - 1,
            }),
          ).toEqual(s.length - 1);
        }),
      );
    });
  });

  describe("or", () => {
    it("Picks the first if Ok", () => {
      expect(simplify(Result.Ok("foo").or(Result.Ok("bar")))).toEqual(simplify(Result.Ok("foo")));
    });
    it("Picks the second if first Error", () => {
      expect(simplify(Result.Error("error").or(Result.Ok("bar")))).toEqual(
        simplify(Result.Ok("bar")),
      );
    });
    it("Picks the second if both Error", () => {
      expect(simplify(Result.Error("error1").or(Result.Error("error2")))).toEqual(
        simplify(Result.Error("error2")),
      );
    });
  });

  describe("replace", () => {
    it("Returns something if both are Ok", () => {
      expect(simplify(Result.Ok("foo").replace(Result.Ok("bar")))).toEqual(
        simplify(Result.Ok("bar")),
      );
    });
    it("Returns Error if the second is Error", () => {
      expect(simplify(Result.Ok("foo").replace(Result.Error("error")))).toEqual(
        simplify(Result.Error("error")),
      );
    });
    it("Returns Error if the first is Error", () => {
      expect(simplify(Result.Error("error").replace(Result.Ok("bar")))).toEqual(
        simplify(Result.Error("error")),
      );
    });
    it("Returns Error if both are Error", () => {
      expect(simplify(Result.Error("error1").replace(Result.Error("error2")))).toEqual(
        simplify(Result.Error("error1")),
      );
    });
  });

  describe("replacePure", () => {
    it("Replaces value if Ok", () => {
      expect(simplify(Result.Ok("foo").replacePure(2))).toEqual(simplify(Result.Ok(2)));
    });
    it("Returns Error if Error", () => {
      expect(simplify(Result.Error("error").replacePure(2))).toEqual(
        simplify(Result.Error("error")),
      );
    });
  });

  describe("swap", () => {
    it("Replaces Error with Ok", () => {
      expect(simplify(Result.Ok("foo").swap())).toEqual(simplify(Result.Error("foo")));
    });
    it("Replaces Ok with Error", () => {
      expect(simplify(Result.Error("error").swap())).toEqual(simplify(Result.Ok("error")));
    });
    it("Applying twice is equivalent to id", () => {
      fc.assert(
        fc.property(fc.anything(), a => {
          expect(
            simplify(
              Result.Ok(a)
                .swap()
                .swap(),
            ),
          ).toEqual(simplify(Result.Ok(a)));
          expect(
            simplify(
              Result.Error(a)
                .swap()
                .swap(),
            ),
          ).toEqual(simplify(Result.Error(a)));
        }),
      );
    });
  });

  describe("toArray", () => {
    it("Returns singleton array if Ok", () => {
      expect(Result.Ok("foo").toArray()).toEqual(["foo"]);
    });
    it("Returns empty array if Error", () => {
      expect(Result.Error("error").toArray()).toEqual([]);
    });
  });

  describe("maybeValue", () => {
    it("Returns Maybe.Just if Ok", () => {
      expect(simplify(Result.Ok("foo").maybeValue)).toEqual(simplify(Maybe.Just("foo")));
    });
    it("Returns Maybe.Nothing if Error", () => {
      expect(simplify(Result.Error("error").maybeValue)).toEqual(simplify(Maybe.Nothing()));
    });
  });

  describe("maybeError", () => {
    it("Returns Maybe.Nothing if Ok", () => {
      expect(simplify(Result.Ok("foo").maybeError)).toEqual(simplify(Maybe.Nothing()));
    });
    it("Returns Maybe.Just if Error", () => {
      expect(simplify(Result.Error("error").maybeError)).toEqual(simplify(Maybe.Just("error")));
    });
  });

  describe("toString", () => {
    it("Renders Error (e) as Error (e)", () => {
      expect(Result.Error("error").toString()).toEqual("Error (error)");
    });
    it("Renders Ok(s) as Ok (s)", () => {
      expect(Result.Ok("foo").toString()).toEqual("Ok (foo)");
    });
  });

  describe("voidOut", () => {
    it("Returns Error (s) for Error (s)", () => {
      expect(simplify(Result.Error("error").voidOut())).toEqual(simplify(Result.Error("error")));
    });
    it("Returns Ok ([]) for Ok (s)", () => {
      expect(simplify(Result.Ok("foo").voidOut())).toEqual(simplify(Result.Ok(undefined)));
    });
  });
});

export const arbitraryEither = <a, b>(arbA: fc.Arbitrary<a>, arbB: fc.Arbitrary<b>) =>
  fc.oneof(arbA.map<Result<b, a>>(Result.Error), arbB.map<Result<b, a>>(Result.Ok));
