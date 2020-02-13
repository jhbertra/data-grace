import * as fc from "fast-check";
import {
  and,
  intercalate,
  MapArray,
  maximum,
  minimum,
  or,
  product,
  replicate,
  sum,
  unzip,
} from "../src/array";
import { id, prove } from "../src/prelude";
import { Equals } from "../src/utilityTypes";

// Map the fields of an object
prove<Equals<MapArray<{ bar: number; baz: string }>, { bar: number[]; baz: string[] }>>("proof");

// Map the items of an array
prove<Equals<MapArray<string[]>, string[][]>>("proof");

describe("and", () => {
  it("returns true for empty lists", () => {
    expect(and([])).toEqual(true);
  });
  it("ands all the elements", () => {
    fc.assert(
      fc.property(
        fc.array(fc.boolean()),
        bools => and(bools) === bools.reduce((a, b) => a && b, true),
      ),
    );
  });
});

describe("intercalate", () => {
  it("returns empty for empty lists", () => {
    fc.assert(
      fc.property(fc.array(fc.anything()), arr => {
        expect(intercalate(arr, [])).toEqual([]);
      }),
    );
  });
  it("intersperses the seperator and concatenates the result", () => {
    fc.assert(
      fc.property(fc.array(fc.anything()), fc.array(fc.array(fc.anything())), (sep, xss) => {
        expect(intercalate(sep, xss)).toEqual(([] as any[]).concat(...xss.intersperse(sep)));
      }),
    );
  });
});

describe("maximum", () => {
  it("returns MIN_VALUE for empty lists", () => {
    expect(maximum([])).toEqual(Number.MIN_VALUE);
  });
  it("picks the largest number in a list", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer()),
        nums => maximum(nums) === nums.reduce((a, b) => Math.max(a, b), Number.MIN_VALUE),
      ),
    );
  });
});

describe("minimum", () => {
  it("returns MAX_VALUE for empty lists", () => {
    expect(minimum([])).toEqual(Number.MAX_VALUE);
  });
  it("picks the largest number in a list", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer()),
        nums => minimum(nums) === nums.reduce((a, b) => Math.min(a, b), Number.MAX_VALUE),
      ),
    );
  });
});

describe("or", () => {
  it("returns false for empty lists", () => {
    expect(or([])).toEqual(false);
  });
  it("ors all the elements", () => {
    fc.assert(
      fc.property(
        fc.array(fc.boolean()),
        bools => or(bools) === bools.reduce((a, b) => a || b, false),
      ),
    );
  });
});

describe("product", () => {
  it("returns 1 for empty lists", () => {
    expect(product([])).toEqual(1);
  });
  it("multiplies all the elements", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer()),
        nums => product(nums) === nums.reduce((a, b) => a * b, 1),
      ),
    );
  });
});

describe("replicate", () => {
  it("returns empty list for non-positive integers", () => {
    fc.assert(
      fc.property(fc.integer(Number.MIN_SAFE_INTEGER, 0), fc.anything(), (size, input) =>
        replicate(size, input).isEmpty(),
      ),
    );
  });
  it("creates arrays of times length", () => {
    fc.assert(
      fc.property(
        fc.nat(100),
        fc.anything(),
        (times, input) => replicate(times, input).length === times,
      ),
    );
  });
  it("all items are equal to the input", () => {
    fc.assert(
      fc.property(fc.nat(100), fc.anything(), (times, input) => {
        replicate(times, input).map(x => expect(x).toEqual(input));
      }),
    );
  });
});

describe("sum", () => {
  it("returns 0 for empty lists", () => {
    expect(sum([])).toEqual(0);
  });
  it("adds all the elements", () => {
    fc.assert(
      fc.property(fc.array(fc.integer()), nums => sum(nums) === nums.reduce((a, b) => a + b, 0)),
    );
  });
});

describe("unzip", () => {
  it("returns n empty buckets for empty lists", () => {
    fc.assert(
      fc.property(fc.nat(20), size => {
        const unzipped = unzip([] as any[][], size);
        return unzipped.length === size && unzipped.all(x => x.isEmpty());
      }),
    );
  });
  it("returns n equal length buckets for non-empty lists", () => {
    fc.assert(
      fc.property(
        fc
          .nat(20)
          .chain(size =>
            fc
              .array(fc.genericTuple(replicate(size, fc.anything())))
              .map(arr => [size, arr] as [number, any[][]]),
          ),
        ([size, arr]) => {
          const unzipped = unzip(arr, size);
          expect(unzipped.length).toEqual(size);
          unzipped.map((x, i) => expect(x).toEqual(arr.map(y => y[i])));
        },
      ),
    );
  });
});

describe("IArrayExtensions", () => {
  describe("all", () => {
    it("returns true for empty lists", () => {
      expect([].all(() => false)).toEqual(true);
    });
    it("requires all elements to pass the predicate", () => {
      fc.assert(
        fc.property(
          fc.array(fc.boolean()),
          bools => bools.all(id) === bools.reduce((a, b) => a && b, true),
        ),
      );
    });
  });

  describe("any", () => {
    it("returns false for empty lists", () => {
      expect([].any(() => true)).toEqual(false);
    });
    it("requires any elements to pass the predicate", () => {
      fc.assert(
        fc.property(
          fc.array(fc.boolean()),
          bools => bools.any(id) === bools.reduce((a, b) => a || b, false),
        ),
      );
    });
  });

  describe("break", () => {
    it("returns empty lists for empty lists", () => {
      expect([].break(() => true)).toEqual([[], []]);
    });
    it("breaks a list in two when it encounters an element that passes the predicate", () => {
      expect([1, 2, 3, 4, 1, 2, 3, 4].break(x => x > 3)).toEqual([
        [1, 2, 3],
        [4, 1, 2, 3, 4],
      ]);
    });
    it("breaks at the start", () => {
      expect([1, 2, 3].break(x => x < 9)).toEqual([[], [1, 2, 3]]);
    });
    it("breaks at the end", () => {
      expect([1, 2, 3].break(x => x > 9)).toEqual([[1, 2, 3], []]);
    });
  });

  describe("chain", () => {
    it("equals map + concat", () => {
      fc.assert(
        fc.property(fc.array(fc.nat(10)), input => {
          expect(input.chain(x => replicate(x, x))).toEqual(
            ([] as number[]).concat(...input.map(x => replicate(x, x))),
          );
        }),
      );
    });
  });

  describe("contains", () => {
    it("depends on if the item exists in the array", () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer()),
          fc.integer(),
          (input, elem) => input.contains(elem) === !!input.find(x => x === elem),
        ),
      );
    });
  });

  describe("distinct", () => {
    it("removes duplicate elements", () => {
      fc.assert(
        fc.property(fc.array(fc.string()), arr => {
          arr.distinct().map((x, i, self) => expect(self.indexOf(x)).toEqual(i));
        }),
      );
    });
    it("is idempotent", () => {
      fc.assert(
        fc.property(fc.array(fc.string()), arr => {
          expect(arr.distinct().distinct()).toEqual(arr.distinct());
        }),
      );
    });
  });

  describe("distinctBy", () => {
    const equals = (a: string, b: string) => a.length === b.length;
    it("removes duplicate elements", () => {
      fc.assert(
        fc.property(fc.array(fc.string()), arr => {
          arr
            .distinctBy(equals)
            .map((x, i, self) => expect(self.findIndex(y => equals(x, y))).toEqual(i));
        }),
      );
    });
    it("is idempotent", () => {
      fc.assert(
        fc.property(fc.array(fc.string()), arr => {
          expect(arr.distinctBy(equals).distinctBy(equals)).toEqual(arr.distinctBy(equals));
        }),
      );
    });
  });

  describe("dropWhile", () => {
    const predicate = (s: string) => s.length !== 10;
    it("returns empty lists if all items pass the predicate", () => {
      fc.assert(
        fc.property(fc.array(fc.string().filter(predicate)), arr => {
          expect(arr.dropWhile(predicate)).toEqual([]);
        }),
      );
    });
    it("returns the full array if the first item passes the predicate", () => {
      fc.assert(
        fc.property(fc.string(10, 10), fc.array(fc.string().filter(predicate)), (fst, arr) => {
          expect([fst, ...arr].dropWhile(predicate)).toEqual([fst, ...arr]);
        }),
      );
    });
    it("returns the array starting when the predicate passes", () => {
      fc.assert(
        fc.property(
          fc.array(fc.string().filter(predicate)),
          fc.string(10, 10),
          fc.array(fc.string().filter(predicate)),
          (fst, breaker, arr) => {
            expect([...fst, breaker, ...arr].dropWhile(predicate)).toEqual([breaker, ...arr]);
          },
        ),
      );
    });
    it("is idempotent", () => {
      fc.assert(
        fc.property(fc.array(fc.string()), arr => {
          expect(arr.dropWhile(predicate).dropWhile(predicate)).toEqual(arr.dropWhile(predicate));
        }),
      );
    });
  });

  describe("group", () => {
    it("Produces arrays of arrays where all elements in elements are equal", () => {
      fc.assert(
        fc.property(fc.array(fc.string()), arr => arr.group().all(g => g.all(x => x === g[0]))),
      );
    });
    it("Produces arrays whose adjacent groups do not contain equal elements", () => {
      fc.assert(
        fc.property(fc.array(fc.string()), arr =>
          arr
            .group()
            .scan(([_, prev], current) => [prev, current] as [string[], string[]], [[], []] as [
              string[],
              string[],
            ])
            .filter(x => !(x[0].isEmpty() || x[1].isEmpty()))
            .all(([g, succ]) => g[0] !== succ[0]),
        ),
      );
    });
    it("Produces the input array when concatenated", () => {
      fc.assert(
        fc.property(fc.array(fc.string()), arr => {
          expect(arr.group().chain(id)).toEqual(arr);
        }),
      );
    });
    it("Is equivalent to groupBy with === as equality function", () => {
      fc.assert(
        fc.property(fc.array(fc.string()), arr => {
          expect(arr.group()).toEqual(arr.groupBy((a, b) => a === b));
        }),
      );
    });
  });

  describe("groupBy", () => {
    const equals = (a: string, b: string) => a.length === b.length;
    it("Produces arrays of arrays where all elements in elements pass the equality test", () => {
      fc.assert(
        fc.property(fc.array(fc.string()), arr =>
          arr.groupBy(equals).all(g => g.all(x => equals(x, g[0]))),
        ),
      );
    });
    it("Produces arrays whose adjacent groups do not contain equal elements", () => {
      fc.assert(
        fc.property(fc.array(fc.string()), arr =>
          arr
            .groupBy(equals)
            .scan(([_, prev], current) => [prev, current] as [string[], string[]], [[], []] as [
              string[],
              string[],
            ])
            .filter(x => !(x[0].isEmpty() || x[1].isEmpty()))
            .all(([g, succ]) => !equals(g[0], succ[0])),
        ),
      );
    });
    it("Produces the input array when concatenated", () => {
      fc.assert(
        fc.property(fc.array(fc.string()), arr => {
          expect(arr.groupBy(equals).chain(id)).toEqual(arr);
        }),
      );
    });
  });

  describe("groupByKey", () => {
    it("produces a distinct set of keys", () => {
      fc.assert(
        fc.property(fc.array(fc.string()), arr => {
          const keys = arr.groupByKey(x => x.length).map(x => x[0]);
          expect(keys.distinct()).toEqual(keys);
        }),
      );
    });
    it("does not drop values", () => {
      fc.assert(
        fc.property(fc.array(fc.string()), arr => {
          const flattened = arr.groupByKey(x => x.length).chain(x => x[1]);
          expect(flattened.length).toEqual(arr.length);
          expect(flattened.sort()).toEqual(arr.sort());
        }),
      );
    });
    it("produces sets which all satisfy the same key", () => {
      fc.assert(
        fc.property(fc.array(fc.string()), arr =>
          arr.groupByKey(x => x.length).all(([key, g]) => g.all(x => x.length === key)),
        ),
      );
    });
  });

  describe("head", () => {
    it("returns undefined for empty arrays", () => {
      expect([].head()).toBeUndefined();
    });
    it("returns the first element of a non-empty array", () => {
      fc.assert(
        fc.property(
          fc.array(fc.anything()).filter(x => !x.isEmpty()),
          arr => {
            expect(arr.head()).toEqual(arr[0]);
          },
        ),
      );
    });
  });

  describe("init", () => {
    it("returns undefined for empty arrays", () => {
      expect([].init()).toBeUndefined();
    });
    it("returns all but the last element for a non-empty array", () => {
      fc.assert(
        fc.property(
          fc.array(fc.anything()).filter(x => !x.isEmpty()),
          arr => {
            expect(arr.init()).toEqual(arr.slice(0, arr.length - 1));
          },
        ),
      );
    });
  });

  describe("inits", () => {
    it("returns one empty array for empty arrays", () => {
      expect([].inits()).toEqual([[]]);
    });
    it("returns all prefixes of a non-empty array", () => {
      fc.assert(
        fc.property(
          fc.array(fc.anything()).filter(x => !x.isEmpty()),
          arr => {
            expect(arr.inits()).toEqual(
              arr.reduce<unknown[][]>((state, _, i) => [...state, arr.slice(0, i + 1)], [[]]),
            );
          },
        ),
      );
    });
  });

  describe("intersperse", () => {
    it("returns empty array for empty arrays", () => {
      expect(([] as string[]).intersperse("BANG")).toEqual([]);
    });
    it("puts the separator between each element for a non-empty array", () => {
      fc.assert(
        fc.property(
          fc.array(fc.anything()).filter(x => !x.isEmpty()),
          arr => {
            expect(arr.intersperse("BANG")).toEqual(arr.chain(x => [x, "BANG"]).init());
          },
        ),
      );
    });
  });

  describe("isEmpty", () => {
    it("returns true for empty arrays", () => {
      expect(([] as string[]).isEmpty()).toEqual(true);
    });
    it("returns false for non-empty arrays", () => {
      fc.assert(
        fc.property(
          fc.array(fc.anything()).filter(x => !x.isEmpty()),
          arr => !arr.isEmpty(),
        ),
      );
    });
  });

  describe("isInfixOf", () => {
    it("returns true for empty arrays", () => {
      fc.assert(fc.property(fc.array(fc.anything()), arr => ([] as any[]).isInfixOf(arr)));
    });
    it("returns equals contains for single element", () => {
      fc.assert(
        fc.property(
          fc.integer(),
          fc.array(fc.integer()),
          (elem, arr) => [elem].isInfixOf(arr) === arr.contains(elem),
        ),
      );
    });
    it("returns true if it occurs in the array", () => {
      expect([3, 4, 5].isInfixOf([1, 2, 3, 4, 5, 6, 7])).toEqual(true);
    });
    it("returns false if it does not occur in the array", () => {
      expect([3, 4, 6].isInfixOf([1, 2, 3, 4, 5, 6, 7])).toEqual(false);
    });
    it("returns true if isPrefixOf returns true", () => {
      fc.assert(
        fc.property(fc.array(fc.integer()), fc.array(fc.integer()), (prefix, arr) =>
          prefix.isPrefixOf(arr) ? prefix.isInfixOf(arr) : true,
        ),
      );
    });
    it("returns true if isSuffixOF returns true", () => {
      fc.assert(
        fc.property(fc.array(fc.integer()), fc.array(fc.integer()), (prefix, arr) =>
          prefix.isSuffixOf(arr) ? prefix.isInfixOf(arr) : true,
        ),
      );
    });
  });

  describe("containsRange", () => {
    it("is the reverse of isInfixOf", () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer()),
          fc.array(fc.integer()),
          (arr1, arr2) => arr1.containsRange(arr2) === arr2.isInfixOf(arr1),
        ),
      );
    });
  });

  describe("isPrefixOf", () => {
    it("returns true for empty arrays", () => {
      fc.assert(fc.property(fc.array(fc.anything()), arr => ([] as any[]).isPrefixOf(arr)));
    });
    it("returns true if it occurs at the start the array", () => {
      fc.assert(
        fc.property(fc.array(fc.integer()), fc.array(fc.integer()), (prefix, arr) =>
          prefix.isPrefixOf([...prefix, ...arr]),
        ),
      );
    });
    it("returns false if it does not occur at the start of the array", () => {
      expect([1, 2, 3].isPrefixOf([2, 3, 4, 5])).toEqual(false);
    });
  });

  describe("startsWith", () => {
    it("is the reverse of isPrefixOf", () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer()),
          fc.array(fc.integer()),
          (arr1, arr2) => arr1.startsWith(arr2) === arr2.isPrefixOf(arr1),
        ),
      );
    });
  });

  describe("isSuffixOf", () => {
    it("returns true for empty arrays", () => {
      fc.assert(fc.property(fc.array(fc.anything()), arr => ([] as any[]).isSuffixOf(arr)));
    });
    it("returns true if it occurs at the start the array", () => {
      fc.assert(
        fc.property(fc.array(fc.integer()), fc.array(fc.integer()), (suffix, arr) =>
          suffix.isSuffixOf([...arr, ...suffix]),
        ),
      );
    });
    it("returns false if it does not occur at the start of the array", () => {
      expect([4, 5, 6].isSuffixOf([2, 3, 4, 5])).toEqual(false);
    });
  });

  describe("endsWith", () => {
    it("is the reverse of isSuffixOf", () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer()),
          fc.array(fc.integer()),
          (arr1, arr2) => arr1.endsWith(arr2) === arr2.isSuffixOf(arr1),
        ),
      );
    });
  });

  describe("last", () => {
    it("returns undefined for empty arrays", () => {
      expect([].last()).toBeUndefined();
    });
    it("returns the last element of a non-empty array", () => {
      fc.assert(
        fc.property(
          fc.array(fc.anything()).filter(x => !x.isEmpty()),
          arr => {
            expect(arr.last()).toEqual(arr.reverse()[0]);
          },
        ),
      );
    });
  });

  describe("partition", () => {
    const predicate = (s: string) => s.length !== 10;
    it("partitions the array by the predicate", () => {
      fc.assert(
        fc.property(fc.array(fc.string()), arr => {
          expect(arr.partition(predicate)).toEqual([
            arr.filter(predicate),
            arr.filter(x => !predicate(x)),
          ]);
        }),
      );
    });
  });

  describe("scan", () => {
    const reduce = (total: string, s: string) => total.concat(s);
    it("produces a series of reductions", () => {
      fc.assert(
        fc.property(fc.string(), fc.array(fc.string()), (seed, arr) => {
          expect(arr.scan(reduce, seed)).toEqual(
            arr.reduce(
              (state, s) => {
                const start = state.init() as string[];
                const prev = state.last() as string;
                return [...start, prev, reduce(prev, s)];
              },
              [seed],
            ),
          );
        }),
      );
    });
  });

  describe("scanRight", () => {
    const reduce = (s: string, total: string) => s.concat(total);
    it("produces a series of reductions from the right", () => {
      fc.assert(
        fc.property(fc.string(), fc.array(fc.string()), (seed, arr) => {
          expect(arr.scanRight(reduce, seed)).toEqual(
            arr.reduceRight(
              (state, s) => {
                const start = state.init() as string[];
                const prev = state.last() as string;
                return [...start, prev, reduce(s, prev)];
              },
              [seed],
            ),
          );
        }),
      );
    });
  });

  describe("span", () => {
    it("returns empty lists for empty lists", () => {
      expect([].span(() => true)).toEqual([[], []]);
    });
    it("breaks a list in two when it encounters an element that fails the predicate", () => {
      expect([1, 2, 3, 4, 1, 2, 3, 4].span(x => x <= 3)).toEqual([
        [1, 2, 3],
        [4, 1, 2, 3, 4],
      ]);
    });
    it("breaks at the start", () => {
      expect([1, 2, 3].span(x => x <= 0)).toEqual([[], [1, 2, 3]]);
    });
    it("breaks at the end", () => {
      expect([1, 2, 3].span(x => x < 9)).toEqual([[1, 2, 3], []]);
    });
  });

  describe("splitAt", () => {
    it("equals two slices", () => {
      fc.assert(
        fc.property(fc.integer(), fc.array(fc.anything()), (n, arr) => {
          const clamped = Math.max(0, Math.min(n, arr.length));
          expect(arr.splitAt(n)).toEqual([arr.slice(0, clamped), arr.slice(clamped)]);
        }),
      );
    });
  });

  describe("tail", () => {
    it("returns undefined for empty arrays", () => {
      expect([].tail()).toBeUndefined();
    });
    it("returns all but the first element for a non-empty array", () => {
      fc.assert(
        fc.property(
          fc.array(fc.anything()).filter(x => !x.isEmpty()),
          arr => {
            expect(arr.tail()).toEqual(arr.slice(1, arr.length));
          },
        ),
      );
    });
  });

  describe("tails", () => {
    it("returns one empty array for empty arrays", () => {
      expect([].tails()).toEqual([[]]);
    });
    it("returns all prefixes of a non-empty array", () => {
      fc.assert(
        fc.property(
          fc.array(fc.anything()).filter(x => !x.isEmpty()),
          arr => {
            expect(arr.tails()).toEqual(
              arr.reduce<unknown[][]>((state, _, i) => [...state, arr.slice(i + 1, arr.length)], [
                arr,
              ]),
            );
          },
        ),
      );
    });
  });

  describe("takeWhile", () => {
    const predicate = (s: string) => s.length !== 10;
    it("returns the full array if all items pass the predicate", () => {
      fc.assert(
        fc.property(fc.array(fc.string().filter(predicate)), arr => {
          expect(arr.takeWhile(predicate)).toEqual(arr);
        }),
      );
    });
    it("returns an empty array if the first item passes the predicate", () => {
      fc.assert(
        fc.property(fc.string(10, 10), fc.array(fc.string().filter(predicate)), (fst, arr) => {
          expect([fst, ...arr].takeWhile(predicate)).toEqual([]);
        }),
      );
    });
    it("returns the array until the predicate passes", () => {
      fc.assert(
        fc.property(
          fc.array(fc.string().filter(predicate)),
          fc.string(10, 10),
          fc.array(fc.string().filter(predicate)),
          (fst, breaker, arr) => {
            expect([...fst, breaker, ...arr].takeWhile(predicate)).toEqual(fst);
          },
        ),
      );
    });
    it("is idempotent", () => {
      fc.assert(
        fc.property(fc.array(fc.string()), arr => {
          expect(arr.takeWhile(predicate).takeWhile(predicate)).toEqual(arr.takeWhile(predicate));
        }),
      );
    });
  });

  describe("zip", () => {
    it("returns an array of the minimum length of its inputs", () => {
      fc.assert(
        fc.property(fc.array(fc.anything()), fc.array(fc.array(fc.anything())), (arr, inputs) => {
          expect(arr.zip(...inputs)).toHaveLength(
            minimum([arr.length, ...inputs.map(x => x.length)]),
          );
        }),
      );
    });
    it("zips the arrays positionally", () => {
      fc.assert(
        fc.property(fc.array(fc.anything()), fc.array(fc.array(fc.anything())), (arr, inputs) => {
          const zipped = arr.zip(...inputs);
          expect(zipped).toEqual(zipped.map((_, i) => [arr, ...inputs].map(x => x[i])));
        }),
      );
    });
    it("equals zipWith(id)", () => {
      fc.assert(
        fc.property(fc.array(fc.anything()), fc.array(fc.array(fc.anything())), (arr, inputs) => {
          expect(arr.zip(...inputs)).toEqual(arr.zipWith((...xs) => xs, ...inputs));
        }),
      );
    });
  });

  describe("zipWith", () => {
    it("returns an array of the minimum length of its inputs", () => {
      fc.assert(
        fc.property(fc.array(fc.anything()), fc.array(fc.array(fc.anything())), (arr, inputs) => {
          expect(arr.zipWith((..._) => [], ...inputs)).toHaveLength(
            minimum([arr.length, ...inputs.map(x => x.length)]),
          );
        }),
      );
    });
    it("zips the arrays positionally with the function", () => {
      fc.assert(
        fc.property(fc.array(fc.anything()), fc.array(fc.array(fc.anything())), (arr, inputs) => {
          const zipped = arr.zipWith((...xs) => xs.reverse(), ...inputs);
          expect(zipped).toEqual(zipped.map((_, i) => [arr, ...inputs].reverse().map(x => x[i])));
        }),
      );
    });
  });
});
