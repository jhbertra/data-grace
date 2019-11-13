import fc from "fast-check";
import "./array";
import {
  constant,
  curry,
  id,
  objectFromEntries,
  objectToEntries,
  pipe,
  pipeWith
} from "./prelude";

describe("constant", () => {
  it("Returns the same input always", () => {
    fc.assert(
      fc.property(fc.anything(), fc.anything(), (input, x) =>
        expect(constant(input)(x)).toEqual(input)
      )
    );
  });
});

describe("curry", () => {
  const f = (a: string, b: number, c: boolean) => a.length + b > 0 && c;
  it("Returns the same as the uncurried function", () => {
    fc.assert(
      fc.property(fc.string(), fc.integer(), fc.boolean(), (a, b, c) =>
        expect(curry(f)(a)(b)(c)).toEqual(f(a, b, c))
      )
    );
  });
});

describe("id", () => {
  it("Returns its input", () => {
    fc.assert(fc.property(fc.anything(), x => expect(id(x)).toEqual(x)));
  });
});

describe("objectFromEntries", () => {
  it("creates an object from the entries", () => {
    fc.assert(
      fc.property(fc.array(fc.tuple(fc.string(), fc.anything())), entries => {
        const expected = entries.reduce(
          (state, [key, value]) => ({ ...state, [key]: value }),
          {}
        );
        expect(objectFromEntries(entries)).toEqual(expected);
      })
    );
  });
  it("returns the initial result if passed the output of objectToEntries", () => {
    fc.assert(
      fc.property(fc.object(), (obj: object) => {
        expect(objectFromEntries(objectToEntries(obj))).toEqual(obj);
      })
    );
  });
});

describe("objectToEntries", () => {
  it("creates entries from an object", () => {
    fc.assert(
      fc.property(fc.object(), (obj: any) => {
        const expected = Object.keys(obj).map(key => [key, obj[key]]);
        expect(objectToEntries(obj)).toEqual(expected);
      })
    );
  });
});

describe("pipe", () => {
  it("feeds an item through the functions in order", () => {
    const f = (a: number) => a + 1;
    expect(pipe(f)(0)).toEqual(1);
    expect(pipe(f, f)(0)).toEqual(2);
    expect(pipe(f, f, f)(0)).toEqual(3);
    expect(pipe(f, f, f, f)(0)).toEqual(4);
    expect(pipe(f, f, f, f, f)(0)).toEqual(5);
    expect(pipe(f, f, f, f, f, f)(0)).toEqual(6);
    expect(pipe(f, f, f, f, f, f, f)(0)).toEqual(7);
    expect(pipe(f, f, f, f, f, f, f, f)(0)).toEqual(8);
    expect(pipe(f, f, f, f, f, f, f, f, f)(0)).toEqual(9);
  });
});

describe("pipeWith", () => {
  it("feeds an item through the functions in order", () => {
    const f = (a: number) => a + 1;
    expect(pipeWith(0, f)).toEqual(1);
    expect(pipeWith(0, f, f)).toEqual(2);
    expect(pipeWith(0, f, f, f)).toEqual(3);
    expect(pipeWith(0, f, f, f, f)).toEqual(4);
    expect(pipeWith(0, f, f, f, f, f)).toEqual(5);
    expect(pipeWith(0, f, f, f, f, f, f)).toEqual(6);
    expect(pipeWith(0, f, f, f, f, f, f, f)).toEqual(7);
    expect(pipeWith(0, f, f, f, f, f, f, f, f)).toEqual(8);
    expect(pipeWith(0, f, f, f, f, f, f, f, f, f)).toEqual(9);
  });
});
