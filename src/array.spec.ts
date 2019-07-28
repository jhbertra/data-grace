import * as fc from "fast-check";
import { unzip, zipWith } from "./array";

describe("zipWith", () => {
    it("passes through two empty lists", () => {
        expect(zipWith((a, b) => 1, [], [])).toEqual([]);
    });
    it("produces an empty list when the left argument is empty", () => {
        expect(zipWith((a, b) => a + b, [1], [])).toEqual([]);
    });
    it("produces an empty list when the right argument is empty", () => {
        expect(zipWith((a, b) => a + b, [], [1])).toEqual([]);
    });
    it("produces the same results as the reference implementation", () => {
        fc.assert(fc.property(fc.array(fc.integer()), fc.array(fc.integer()), propZipWithReference));
    });
});

const zipWithReference: <A, B, C>(f: (a: A, b: B) => C, as: A[], bs: B[]) => C[] = (f, as, bs) => {
    if (as.length === 0 || bs.length === 0) {
        return [];
    } else {
        return [f(as[0], bs[0]), ...zipWithReference(f, as.slice(1), bs.slice(1))];
    }
};

const propZipWithReference: (as: number[], bs: number[]) => void =
    (as, bs) => expect(zipWith((a, b) => a + b, as, bs)).toEqual(zipWithReference((a, b) => a + b, as, bs));

describe("unzip", () => {
    it("passes through an empty list", () => {
        expect(unzip([])).toEqual([[], []]);
    });
    it("produces the same results as the reference implementation", () => {
        fc.assert(fc.property(fc.array(fc.tuple(fc.integer(), fc.string())), propUnzipReference));
    });
});

function unzipReference<A, B>(list: Array<[A, B]>): [A[], B[]] {
    return list.reduce(
        ([as, bs], [a, b]) => [[...as, a], [...bs, b]],
        [[], []] as [A[], B[]]);
}

const propUnzipReference: (list: Array<[number, string]>) => void =
    (list) => expect(unzip(list)).toEqual(unzipReference(list));
