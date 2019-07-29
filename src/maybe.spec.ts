import * as fc from "fast-check";
import * as M from "./maybe";

describe("arrayToMaybe", () => {
    it("returns nothing when input is empty", () => {
        expect(M.arrayToMaybe([]).toString()).toEqual(M.Nothing().toString());
    });
    it("returns the first element when the input is not empty", () => {
        fc.assert(
            fc.property(
                fc.array(fc.integer()).filter((x) => x.length > 0),
                (xs: number[]) => {
                    expect(M.arrayToMaybe(xs).toString()).toEqual(M.Just(xs[0]).toString());
                }));
    });
});

describe("catMaybes", () => {
    it("returns every Maybe with a value", () => {
        fc.assert(
            fc.property(
                fc.array(fc.oneof(fc.constant(M.Nothing<number>()), fc.integer().map(M.Just))),
                (xs: Array<M.Maybe<number>>) => {
                    expect(M.catMaybes(xs)).toEqual(xs.filter((x) => x.isJust()).map((x) => (x as any).value));
                }));
    });
});

describe("forM", () => {
    it("produces the same results as mapM", () => {
        fc.assert(
            fc.property(
                fc.array(fc.oneof()),
                (xs: Array<M.Maybe<number>>) => {
                    expect(M.catMaybes(xs)).toEqual(xs.filter((x) => x.isJust()).map((x) => (x as any).value));
                }));
    });
});
