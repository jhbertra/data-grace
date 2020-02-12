import * as fc from "fast-check";
import { Lazy } from "../src";

describe("force", () => {
  it("returns the deferred value", () => {
    fc.assert(
      fc.property(fc.anything(), value => {
        expect(Lazy.delay(() => value).force()).toEqual(value);
      }),
    );
  });
  it("returns the pure value", () => {
    fc.assert(
      fc.property(fc.anything(), value => {
        expect(Lazy.pure(value).force()).toEqual(value);
      }),
    );
  });
  it("only evaluates once", () => {
    fc.assert(
      fc.property(fc.anything(), value => {
        let i = 0;
        const lazy = Lazy.delay(() => {
          ++i;
          return value;
        });
        lazy.force();
        lazy.force();
        expect(i).toEqual(1);
      }),
    );
  });
});

describe("chain", () => {
  it("obeys the left identity monad law", () => {
    const k = (s: string) => Lazy.delay(() => s.length);
    fc.assert(
      fc.property(fc.string(), s => {
        expect(
          Lazy.pure(s)
            .chain(k)
            .force(),
        ).toEqual(k(s).force());
      }),
    );
  });

  it("obeys the right identity monad law", () => {
    fc.assert(
      fc.property(fc.string().map(Lazy.pure), m => {
        expect(m.chain(Lazy.pure).force()).toEqual(m.force());
      }),
    );
  });

  it("obeys the right monad associativity law", () => {
    const k = (s: string) => Lazy.delay(() => s.length);
    const h = (n: number) => Lazy.delay(() => n.toString());

    fc.assert(
      fc.property(fc.string().map(Lazy.pure), m => {
        expect(m.chain(x => k(x).chain(h)).force()).toEqual(
          m
            .chain(k)
            .chain(h)
            .force(),
        );
      }),
    );
  });
});

describe("map", () => {
  it("Passes the payload to the callback", () => {
    fc.assert(
      fc.property(fc.string(), s => {
        Lazy.pure(s).map(x => expect(x).toEqual(s));
      }),
    );
  });
  it("Wraps the value returned by the callback", () => {
    const k = (s: string) => s.length;
    fc.assert(
      fc.property(fc.string(), s => {
        expect(
          Lazy.delay(() => s)
            .map(k)
            .force(),
        ).toEqual(Lazy.pure(k(s)).force());
      }),
    );
  });
});

describe("combine", () => {
  it("Combines values for pure", () => {
    fc.assert(
      fc.property(fc.string(), fc.integer(), (s, i) => {
        expect(
          Lazy.pure(s)
            .combine(Lazy.pure(i))
            .force(),
        ).toEqual([s, i]);
      }),
    );
  });
  it("Combines values for delay", () => {
    fc.assert(
      fc.property(fc.string(), fc.integer(), (s, i) => {
        expect(
          Lazy.delay(() => s)
            .combine(Lazy.delay(() => i))
            .force(),
        ).toEqual([s, i]);
      }),
    );
  });
});
