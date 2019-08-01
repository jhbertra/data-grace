import * as fc from "fast-check";
import { and, intercalate, MapArray, maximum, minimum, or, product, replicate, sum, unzip } from "./array";
import { Equals, prove, id } from "./prelude";

// Map the fields of an object
prove<Equals<MapArray<{ bar: number, baz: string }>, { bar: number[], baz: string[] }>>("proof");

// Map the items of an array
prove<Equals<MapArray<string[]>, string[][]>>("proof");

describe("and", () => {
    it("returns true for empty lists", () => {
        expect(and([])).toEqual(true);
    });
    it("ands all the elements", () => {
        fc.assert(fc.property(
            fc.array(fc.boolean()),
            (bools) => and(bools) === bools.reduce((a, b) => a && b, true)));
    });
});

describe("intercalate", () => {
    it("returns empty for empty lists", () => {
        fc.assert(fc.property(
            fc.array(fc.anything()),
            (arr) => { expect(intercalate(arr, [])).toEqual([]); }));
    });
    it("intersperses the seperator and concatenates the result", () => {
        fc.assert(fc.property(
            fc.array(fc.anything()),
            fc.array(fc.array(fc.anything())),
            (sep, xss) => {
                expect(intercalate(sep, xss)).toEqual(([] as any[]).concat(...xss.intersperse(sep)));
            }));
    });
});

describe("maximum", () => {
    it("returns MIN_VALUE for empty lists", () => {
        expect(maximum([])).toEqual(Number.MIN_VALUE);
    });
    it("picks the largest number in a list", () => {
        fc.assert(fc.property(
            fc.array(fc.integer()),
            (nums) => maximum(nums) === nums.reduce((a, b) => Math.max(a, b), Number.MIN_VALUE)));
    });
});

describe("minimum", () => {
    it("returns MAX_VALUE for empty lists", () => {
        expect(minimum([])).toEqual(Number.MAX_VALUE);
    });
    it("picks the largest number in a list", () => {
        fc.assert(fc.property(
            fc.array(fc.integer()),
            (nums) => minimum(nums) === nums.reduce((a, b) => Math.min(a, b), Number.MAX_VALUE)));
    });
});

describe("or", () => {
    it("returns false for empty lists", () => {
        expect(or([])).toEqual(false);
    });
    it("ors all the elements", () => {
        fc.assert(fc.property(
            fc.array(fc.boolean()),
            (bools) => or(bools) === bools.reduce((a, b) => a || b, false)));
    });
});

describe("product", () => {
    it("returns 1 for empty lists", () => {
        expect(product([])).toEqual(1);
    });
    it("multiplies all the elements", () => {
        fc.assert(fc.property(
            fc.array(fc.integer()),
            (nums) => product(nums) === nums.reduce((a, b) => a * b, 1)));
    });
});

describe("replicate", () => {
    it("returns empty list for non-positive integers", () => {
        fc.assert(fc.property(
            fc.integer(Number.MIN_SAFE_INTEGER, 0),
            fc.anything(),
            (size, input) => replicate(size, input).isEmpty()));
    });
    it("creates arrays of times length", () => {
        fc.assert(fc.property(
            fc.nat(100),
            fc.anything(),
            (times, input) => replicate(times, input).length === times));
    });
    it("all items are equal to the input", () => {
        fc.assert(fc.property(
            fc.nat(100),
            fc.anything(),
            (times, input) => { replicate(times, input).map((x) => expect(x).toEqual(input)); }));
    });
});

describe("sum", () => {
    it("returns 0 for empty lists", () => {
        expect(sum([])).toEqual(0);
    });
    it("adds all the elements", () => {
        fc.assert(fc.property(
            fc.array(fc.integer()),
            (nums) => sum(nums) === nums.reduce((a, b) => a + b, 0)));
    });
});

describe("unzip", () => {
    it("returns n empty buckets for empty lists", () => {
        fc.assert(fc.property(
            fc.nat(20),
            (size) => {
                const unzipped = unzip(size, []as any[][]);
                return unzipped.length === size && unzipped.all((x) => x.isEmpty());
            }));
    });
    it("returns n equal length buckets for non-empty lists", () => {
        fc.assert(fc.property(
            fc
                .nat(20)
                .chain((size) => fc
                    .array(fc.genericTuple(replicate(size, fc.anything())))
                    .map((arr) => [size, arr] as [number, any[][]])),
            ([size, arr]) => {
                const unzipped = unzip(size, arr);
                expect(unzipped.length).toEqual(size);
                unzipped.map((x, i) => expect(x).toEqual(arr.map((y) => y[i])));
            }));
    });
});

describe("IArrayExtensions", () => {
    describe("all", () => {
        it("returns true for empty lists", () => {
            expect(([]).all(() => false)).toEqual(true);
        });
        it("requires all elements to pass the predicate", () => {
            fc.assert(fc.property(
                fc.array(fc.boolean()),
                (bools) => bools.all(id) === bools.reduce((a, b) => a && b, true)));
        });
    });

    describe("any", () => {
        it("returns false for empty lists", () => {
            expect(([]).any(() => true)).toEqual(false);
        });
        it("requires any elements to pass the predicate", () => {
            fc.assert(fc.property(
                fc.array(fc.boolean()),
                (bools) => bools.any(id) === bools.reduce((a, b) => a || b, false)));
        });
    });

    describe("break", () => {
        it("returns empty lists for empty lists", () => {
            expect(([]).break(() => true)).toEqual([[], []]);
        });
        it("breaks a list in two when it encounters an element that passes the predicate", () => {
            expect([1, 2, 3, 4, 1, 2, 3, 4].break((x) => x > 3)).toEqual([[1, 2, 3], [4, 1, 2, 3, 4]]);
        });
        it("breaks at the start", () => {
            expect([1, 2, 3].break((x) => x < 9)).toEqual([[], [1, 2, 3]]);
        });
        it("breaks at the end", () => {
            expect([1, 2, 3].break((x) => x > 9)).toEqual([[1, 2, 3], []]);
        });
    });

    describe("chain", () => {
        it("equals map + concat", () => {
            fc.assert(fc.property(
                fc.array(fc.nat(10)),
                (input) => {
                    expect(input.chain((x) => replicate(x, x)))
                        .toEqual(([] as number[]).concat(...input.map((x) => replicate(x, x))));
                }));
        });
    });

    describe("contains", () => {
        it("depends on if the item exists in the array", () => {
            fc.assert(fc.property(
                fc.array(fc.integer()),
                fc.integer(),
                (input, elem) => input.contains(elem) === !!input.find((x) => x === elem) ));
        });
    });
});

/*
    dropWhile(p: (a: A) => boolean): A[];
    group(): A[][];
    groupBy<B>(getKey: (a: A) => B): Array<[B, A[]]>;
    head(): A;
    init(): A[];
    inits(): A[][];
    intersperse(t: A): A[];
    isEmpty(): boolean;
    isInfixOf(other: A[]): boolean;
    isInfixedBy(other: A[]): boolean;
    isPrefixOf(other: A[]): boolean;
    isPrefixedBy(other: A[]): boolean;
    isSuffixOf(other: A[]): boolean;
    isSuffixedBy(other: A[]): boolean;
    last(): A;
    partition(p: (a: A) => boolean): [A[], A[]];
    scan<B>(reduce: (b: B, a: A) => B, seed: B): B[];
    scanRight<B>(reduce: (a: A, b: B) => B, seed: B): B[];
    span(p: (a: A) => boolean): [A[], A[]];
    splitAt(index: number): [A[], A[]];
    takeWhile(p: (a: A) => boolean): A[];
    tail(): A[];
    tails(): A[][];
    zip<P extends any[]>(...arr: MapArray<P>): Array<Cons<A, P>>;
    zipWith<P extends any[], B>(f: (a: A, ...p: P) => B, ...arr: MapArray<P>): B[];
*/
