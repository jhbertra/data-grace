import { Cons } from "./utilityTypes";

export {
    IArrayExtensions,
    MapArray,
    and,
    intercalate,
    maximum,
    minimum,
    or,
    product,
    replicate,
    sum,
    unzip,
};

/**
 * Extension methods for the JavaScript [[Array]] type.
 */
interface IArrayExtensions<A> {

    /**
     * Determines whether all elements of the array satisfy a predicate.
     *
     * ```ts
     * [1, 2, 3].all(x => x < 3) // false
     * [1, 2, 3].all(x => x < 4) // true
     * ```
     *
     * @param p The predicate to test the elements of the array against.
     * @returns `true` if all elements satisfy the predicate, `false` otherwise.
     */
    all(p: (a: A) => boolean): boolean;

    /**
     * Determines whether any element of the array satisfies a predicate.
     *
     * ```ts
     * [1, 2, 3].any(x => x < 3) // true
     * [1, 2, 3].any(x => x < 1) // false
     * ```
     *
     * @param p The predicate to test the elements of the array against.
     * @returns `true` if any element satisfies the predicate, `false` otherwise.
     */
    any(p: (a: A) => boolean): boolean;

    /**
     * Returns a tuple where first element is the longest prefix (possibly empty)
     * of this array whose elements do not satisfy p and the second element is the
     * remainder of the array.
     *
     * ```ts
     * [1, 2, 3, 4, 1, 2, 3, 4].break((x) => x > 3) // [[1, 2, 3], [4, 1, 2, 3, 4]]
     * [1, 2, 3].break((x) => x < 9) // [[], [1, 2, 3]]
     * [1, 2, 3].break((x) => x > 9) // [[1, 2, 3], []]
     * ```
     *
     * @param p The predicate to test the elements of the array against.
     * @returns A tuple consisting of `[prefixWherePNotSatisfied, allRemainingElements]`
     */
    break(p: (a: A) => boolean): [A[], A[]];

    /**
     * From each element in this array, get a new array and concatenate the results.
     *
     * ```ts
     * const customers =
     *   [
     *    {
     *      "customer_id": 12
     *      "orders": [{"order_id": 1}, {"order_id": 2}, {"order_id": 3}]
     *    },
     *    {
     *      "customer_id": 13
     *      "orders": [{"order_id": 4}, {"order_id": 5}, {"order_id": 6}]
     *    }
     *   ];
     *
     * // [{"order_id": 1}, {"order_id": 2}, {"order_id": 3}, {"order_id": 4}, {"order_id": 5}, {"order_id": 6}]
     * customers.chain(customer => customer.orders);
     * ```
     *
     * @param f The function which pulls a new array out of each element of this array.
     */
    chain<B>(f: (a: A) => B[]): B[];

    /**
     * Determines whether the array contains a.
     *
     * ```ts
     * [1, 2, 3].contains(2) // true
     * [1, 2, 3].contains(4) // false
     * ```
     *
     * @param a The element to search for
     * @returns `true` if `a` is in the array, `false` otherwise.
     */
    contains(a: A): boolean;

    /**
     * Determines if other is found anywhere in this array.
     *
     * ```ts
     * [1, 2, 3, 4].containsRange([2, 3]) // true
     * [1, 2, 3, 4].containsRange([2, 4]) // false
     * ```
     *
     * @param other The range to search for
     * @returns `true` if `other` is in the array, `false` otherwise.
     */
    containsRange(other: A[]): boolean;

    /**
     * Remove all duplicate entries from this array.
     *
     * ```ts
     * [1, 1, 2, 3, 4, 3, 5, 5].distinct() // [1, 2, 3, 4, 5]
     * ```
     *
     * @returns A new array containing all unique elements from this array with no duplicates.
     */
    distinct(): A[];

    /**
     * Remove all duplicate entries from this array using a user-defined equality test.
     *
     * ```ts
     * ["foo", "food", "bar", "barb", "eugene"].distinctBy(x => x.length) // ["foo", "food", "eugene"]
     * ```
     *
     * @param equals A function which determines if any two items are equal.
     * @returns A new array containing all unique elements from this array with no duplicates.
     */
    distinctBy(equals: (a: A, b: A) => boolean): A[];

    /**
     * Get all elements of this array starting with the first element
     * that does not satisfy `p`.
     *
     * ```ts
     * [1, 2, 3, 4, 5].dropWhile(x => x < 4) // [4, 5]
     * ```
     *
     * @param p The predicate to test the elements of the array against.
     * @returns an array containing all elements of this array starting with
     * the first element that does not satisfy `p`.
     */
    dropWhile(p: (a: A) => boolean): A[];

    /**
     * Determines if other is found at the end of this array.
     *
     * ```ts
     * [1, 2, 3, 4].endsWith([3, 4]) // true
     * [1, 2, 3, 4].endsWith([2, 3]) // false
     * ```
     *
     * @param other The range to search for
     * @returns `true` if `other` equals the end of the array, `false` otherwise.
     */
    endsWith(other: A[]): boolean;

    /**
     * Return an array of arrays where each element contains adjacent equal
     * items found in this array. If the result were concatenated / flattened,
     * it would equal this array.
     *
     * ```ts
     * // [["M"], ["i"], ["s", "s"], ["i"], ["s", "s"], ["i"], ["p", "p"], ["i"]]
     * ["M", "i", "s", "s", "i", "s", "s", "i", "p", "p", "i"].group()
     * ```
     *
     * @returns An array of arrays each containing adjacent equal elements
     */
    group(): A[][];

    /**
     * Return an array of arrays where each element contains adjacent items
     * found in this array which are equal according to a user-defined equality test.
     * If the result were concatenated / flattened, it would equal this array.
     *
     * ```ts
     * // [["M"], ["i", "s", "s", "i", "s", "s", "i", "p", "p", "i"]]
     * ["M", "i", "s", "s", "i", "s", "s", "i", "p", "p", "i"].groupBy(x => x > "Z")
     * ```
     *
     * @param equals A function to determine equality
     * @returns An array of arrays each containing adjacent equal elements
     */
    groupBy(equals: (a: A, b: A) => boolean): A[][];

    /**
     * Group all items in this array which resolve the same key.
     *
     * ```ts
     * [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].groupByKey(x => x % 3) // [[0, [0, 3, 6, 9]], [1, [1, 4, 7]], [2, [2, 5, 8]]]
     * ```
     *
     * @param getKey a function that resolves to the key to group the elements by.
     * @returns an array of `[key, group]` tuples where each element in `group` shares the same `key`.
     */
    groupByKey<B>(getKey: (a: A) => B): Array<[B, A[]]>;

    /**
     * Return the first element of this array if it exists.
     *
     * ```ts
     * [1, 2, 3].head() // 1
     * ["a"].head() // "a"
     * [].head() // undefined
     * ```
     */
    head(): A | undefined;

    /**
     * Return the all but the last element of this array unless it is empty.
     *
     * ```ts
     * [1, 2, 3].init() // [1, 2]
     * ["a"].init() // ["a"]
     * [].init() // undefined
     * ```
     */
    init(): A[] | undefined;

    /**
     * Return the all possible prefixes of this array including the empty array
     * and the full array.
     *
     * ```ts
     * [1, 2, 3].inits() // [[], [1], [1, 2], [1, 2, 3]]
     * ["a"].inits() // [[], ["a"]]
     * [].inits() // [[]]
     * ```
     */
    inits(): A[][];

    /**
     * Insert an element between all elements in this array.
     *
     * ```ts
     * [1, 2, 3].intersperse(0) // [1, 0, 2, 0, 3]
     * ```
     *
     * @param a the element to insert between each element in the array.
     * @returns a copy of this array with `a` interspersed between each element.
     */
    intersperse(a: A): A[];

    /**
     * Determines if this array is empty.
     *
     * ```ts
     * [1, 2, 3].isEmpty() // false
     * [].isEmpty() // true
     * ```
     */
    isEmpty(): boolean;

    /**
     * Determines if this array is found anywhere in `other`.
     *
     * ```ts
     * [2, 3].isInfixOf([1, 2, 3, 4]) // true
     * [2, 4].isInfixOf([1, 2, 3, 4]) // false
     * ```
     *
     * @param other The array to search for this array in.
     * @returns `true` if the array is in `other`, `false` otherwise.
     */
    isInfixOf(other: A[]): boolean;

    /**
     * Determines if this array is found at the start of `other`.
     *
     * ```ts
     * [1, 2].isPrefixOf([1, 2, 3, 4]) // true
     * [2, 3].isPrefixOf([1, 2, 3, 4]) // false
     * ```
     *
     * @param other The array whose start to search for this array.
     * @returns `true` if the array is the start of `other`, `false` otherwise.
     */
    isPrefixOf(other: A[]): boolean;

    /**
     * Determines if this array is found at the end of `other`.
     *
     * ```ts
     * [3, 4].isSuffixOf([1, 2, 3, 4]) // true
     * [2, 3].isSuffixOf([1, 2, 3, 4]) // false
     * ```
     *
     * @param other The array whose end to search for this array.
     * @returns `true` if the array is the end of `other`, `false` otherwise.
     */
    isSuffixOf(other: A[]): boolean;

    /**
     * Return the last element of this array if it exists.
     *
     * ```ts
     * [1, 2, 3].last() // 3
     * ["a"].last() // "a"
     * [].last() // undefined
     * ```
     */
    last(): A | undefined;

    /**
     * Returns a tuple whose first element contains all items in this array that
     * satisfy p and whose second element contains all items that do not.
     *
     * ```ts
     * [1, 2, 3, 4, 5, 6].partition(x => x % 2 === 0) // [[2, 4, 6], [1, 3, 5]]
     * ```
     *
     * @param p The predicate to test the elements of the array against.
     * @returns The array partitioned into an array of items that satisfy `p` and those that do not.
     */
    partition(p: (a: A) => boolean): [A[], A[]];

    /**
     * Return a series of left-associative state reductions on this list. For each element of
     * this array, the inputs of the reducer will be the output of the previous reduction
     * (or seed if it is the first element) and the element.
     *
     * ```ts
     * [1, 2, 3, 4, 5, 6].scan((state, x) => state + x, 0) // [1, 3, 6, 10, 15, 21]
     * [1, 2, 3, 4, 5, 6].scan(([_, prev], x) => [prev, x], [0, 0]) // [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6]]
     * arr.scan(f, seed).last() === arr.reduce(f, seed) // true
     * ```
     *
     * @param reduce A left-associative state-reducing function to thread the array through
     * @return An array containing the result of each state reduction.
     */
    scan<B>(reduce: (b: B, a: A) => B, seed: B): B[];

    /**
     * Return a series of right-associative state reductions on this list. For each element of
     * this array in reverse, the inputs of the reducer will be the element and the output of
     * the previous reduction (or seed if it is the last element).
     *
     * ```ts
     * [1, 2, 3, 4, 5, 6].scanRight((x, state) => x + state, 0) // [6, 11, 15, 18, 20, 21]
     * [1, 2, 3, 4, 5, 6].scan((x, [prev, _]) => [x, prev], [0, 0]) // [[6, 0], [5, 6], [4, 5], [3, 4], [2, 3], [1, 2]]
     * arr.scanRight(f, seed).last() === arr.reduceRight(f, seed) // true
     * ```
     *
     * @param reduce A right-associative state-reducing function to thread the array through.
     * @return An array containing the result of each state reduction.
     */
    scanRight<B>(reduce: (a: A, b: B) => B, seed: B): B[];

    /**
     * Returns a tuple where first element is the longest prefix (possibly empty)
     * of this array whose elements satisfy p and the second element is the
     * remainder of the array.
     *
     * @example
     *
     *  [1, 2, 3, 4, 1, 2, 3, 4].span((x) => x < 3) // [[1, 2, 3], [4, 1, 2, 3, 4]]
     *  [1, 2, 3].span((x) => x > 9) // [[], [1, 2, 3]]
     *  [1, 2, 3].span((x) => x > 0) // [[1, 2, 3], []]
     *
     * @param p The predicate to test the elements of the array against.
     * @returns A tuple consisting of `[prefixWherePIsSatisfied, allRemainingElements]`
     */
    span(p: (a: A) => boolean): [A[], A[]];

    /**
     * Returns a tuple where the first element is the prefix of
     * length n of this array and second element is the remainder of the array.
     * If n is negative, acts as if n were 0, and if n > this.length, acts as if
     * it were this.length.
     *
     * ```ts
     * [1, 2, 3, 4].splitAt(-1) // [[], [1, 2, 3, 4]]
     * [1, 2, 3, 4].splitAt(0) // [[], [1, 2, 3, 4]]
     * [1, 2, 3, 4].splitAt(2) // [[1, 2], [3, 4]]
     * [1, 2, 3, 4].splitAt(4) // [[1, 2, 3, 4], []]
     * [1, 2, 3, 4].splitAt(6) // [[1, 2, 3, 4], []]
     * ```
     *
     * @param index The index at which to split the array
     * @returns The array split at `index`
     */
    splitAt(index: number): [A[], A[]];

    /**
     * Determines if other is found at the start of this array.
     *
     * ```ts
     * [1, 2, 3, 4].startsWith([1, 2]) // true
     * [1, 2, 3, 4].startsWith([2, 3]) // false
     * ```
     *
     * @param other The range to search for
     * @returns `true` if `other` equals the start of the array, `false` otherwise.
     */
    startsWith(other: A[]): boolean;

    /**
     * Get all elements of this array while until an element that does not
     * satisfied p is encountered.
     *
     * ```ts
     * [1, 2, 3, 4, 5].takeWhile(x => x < 4) // [1, 2, 3]
     * ```
     *
     * @param p The predicate to test the elements of the array against.
     * @returns an array containing all elements of this array until the first element that does not satisfy `p`.
     */
    takeWhile(p: (a: A) => boolean): A[];

    /**
     * Return the all but the first element of this array unless it is empty.
     *
     * ```ts
     * [1, 2, 3].tail() // [2, 3]
     * ["a"].tail() // ["a"]
     * [].tail() // undefined
     * ```
     */
    tail(): A[] | undefined;

    /**
     * Return the all possible suffixes of this array including the empty array
     * and the full array.
     *
     * ```ts
     * [1, 2, 3].tails() // [[1, 2, 3], [2, 3], [3], []]
     * ["a"].tails() // [["a"], []]
     * [].tails() // [[]]
     * ```
     */
    tails(): A[][];

    /**
     * Return an array of tuples that contains the items in order from the argument
     * arrays (including this array).
     *
     * ```ts
     * [1, 2, 3].zip() // [[1], [2], [3]]
     * [1, 2, 3].zip(["a", "b"]) // [[1, "a"], [2, "b"]]
     * [1, 2, 3].zip(["a", "b"], [true, false, false, true]) // [[1, "a", true], [2, "b", false]]
     * ```
     */
    zip<P extends any[]>(...arr: MapArray<P>): Array<Cons<A, P>>;

    /**
     * Map a function over the elements of multiple arrays in order and return an
     * array containing the combined results.
     *
     * ```ts
     * [1, 2, 3].zip() // [[1], [2], [3]]
     * [1, 2, 3].zip(["a", "b"]) // [[1, "a"], [2, "b"]]
     * [1, 2, 3].zipWith((n, s, b) => b ? n : s, ["a", "b"], [true, false, false, true]) // [1, "b"]
     * ```
     */
    zipWith<P extends any[], B>(f: (a: A, ...p: P) => B, ...arr: MapArray<P>): B[];
}

/**
 * A type transformer that homomorphically maps the [[Array]] type
 * onto the types of A.
 *
 * ```ts
 * type Example = MapArray<{a: string, b: number}> // Example = {a: string[], b: number[]}
 * ```
 */
type MapArray<A> = { [K in keyof A]: Array<A[K]> };

/**
 * Returns the conjunction of an array of booleans.
 * Returns true if the array is empty.
 *
 * ```ts
 * and([]) // true
 * and([true, false]) // false
 * and([true, true]) // true
 * ```
 */
function and(bools: boolean[]): boolean {
    let result = true;
    for (const b of bools) {
        result = result && b;
    }
    return result;
}

/**
 * Inserts the separator array between the arrays in arrays and
 * concatenates the result.
 *
 * ```ts
 * intercalate([","], [["the"], ["quick", "brown"], ["fox"]]) // ["the", ",", "quick", "brown", ",", "fox"]
 * ```
 */
function intercalate<A>(separator: A[], arrays: A[][]): A[] {
    return ([] as A[]).concat(...arrays.intersperse(separator));
}

/**
 * Returns the largest element in the array.
 *
 * ```ts
 * maximum([]) // Number.MIN_VALUE
 * maximum([0, 1]) // 1
 * maximum([3, 2]) // 3
 * ```
 */
function maximum(nums: number[]): number {
    let result = Number.MIN_VALUE;
    for (const num of nums) {
        if (num > result) {
            result = num;
        }
    }
    return result;
}

/**
 * Returns the smallest element in the array.
 *
 * ```ts
 * minimum([]) // Number.MAX_VALUE
 * minimum([0, 1]) // 0
 * minimum([3, 2]) // 2
 * ```
 */
function minimum(nums: number[]): number {
    let result = Number.MAX_VALUE;
    for (const num of nums) {
        if (num < result) {
            result = num;
        }
    }
    return result;
}

/**
 * Returns the disjunction of an array of booleans.
 * Returns false if the array is empty.
 *
 * ```ts
 * or([]) // false
 * or([false, false]) // false
 * or([true, false]) // true
 * or([true, true]) // true
 * ```
 */
function or(bools: boolean[]): boolean {
    let result = false;
    for (const b of bools) {
        result = result || b;
    }
    return result;
}

/**
 * Returns the product of elements in the array.
 *
 * ```ts
 * product([]) // 1
 * product([0, 1]) // 0
 * product([3, 2]) // 6
 * ```
 */
function product(nums: number[]): number {
    let result = 1;
    for (const num of nums) {
        result *= num;
    }
    return result;
}

/**
 * Returns an array that contains item a specific
 * number of times.
 *
 * ```ts
 * replicate(0, "ha") // []
 * replicate(1, "ha") // ["ha"]
 * replicate(10, "ha") // ["ha", "ha", "ha", "ha", "ha", "ha", "ha", "ha", "ha", "ha"]
 * ```
 */
function replicate<N extends number, A>(times: N, item: A): A[] & { length: N } {
    const result: A[] = [];
    for (let i = 0; i < times; i++) {
        result.push(item);
    }
    return result as any;
}

/**
 * Returns the sum of elements in the array.
 *
 * ```ts
 * sun([]) // 0
 * sun([0, 1]) // 1
 * sun([3, 2]) // 5
 * ```
 */
function sum(nums: number[]): number {
    let result = 0;
    for (const num of nums) {
        result += num;
    }
    return result;
}

/**
 * Take a list of tuples and transform it into a tuple of lists.
 *
 * ```ts
 * unzip([["foo", 1], ["bar", 12]]) // [["foo", "bar"], [1, 12]]
 * unzip([["foo", 1, true], ["bar", 12, false]]) // [["foo", "bar"], [1, 12], [true, false]]
 * unzip(3) // [[], [], []]
 * ```
 */
function unzip<N extends number, P extends any[] & { length: N }>(input: P[], n: N = 0 as any): MapArray<P> {
    const result = [];
    if (input.length > 0) {
        n = input[0].length;
    }
    for (let i = 0; i < n; i++) {
        result.push([] as any[]);
    }
    for (const tuple of input) {
        for (let i = 0; i < n; i++) {
            const element = tuple[i];
            const bucket = result[i];
            bucket.push(element as any);
        }
    }
    return result as any;
}

/**
 * Declares modifications to the global module
 */
declare global {
    /**
     * Declares modifications to the global [[Array]] interface.
     */
    // tslint:disable-next-line:interface-name
    interface Array<T> extends IArrayExtensions<T> { }
}

Array.prototype.all = function allForArray(p) {
    for (const elem of this) {
        if (!p(elem)) {
            return false;
        }
    }
    return true;
};

Array.prototype.any = function anyForArray(p) {
    for (const elem of this) {
        if (p(elem)) {
            return true;
        }
    }
    return false;
};

Array.prototype.break = function breakForArray(p) {
    return this.span((x) => !p(x));
};

Array.prototype.chain = function chainForArray<B>(f: (t: any) => B[]): B[] {
    const result: B[] = [];
    for (const bs of this.map(f)) {
        for (const b of bs) {
            result.push(b);
        }
    }
    return result;
};

Array.prototype.contains = function containsForArray(a) {
    return this.any((x) => x === a);
};

Array.prototype.distinct = function distinctForArray() {
    return this.filter((x, i) => this.indexOf(x) === i);
};

Array.prototype.distinctBy = function distinctByForArray(equals) {
    return this.filter((x, i) => this.findIndex((y) => equals(x, y)) === i);
};

Array.prototype.dropWhile = function dropWhileForArray(p) {
    let i = 0;
    const result = [];
    while (i < this.length && p(this[i])) { ++i; }
    while (i < this.length) {
        result.push(this[i++]);
    }
    return result;
};

Array.prototype.group = function groupForArray() {
    return this.groupBy((a, b) => a === b);
};

Array.prototype.groupBy = function groupByForArray(equals) {
    const result = [];
    const current: [any, any[]] = [null, []];
    for (const elem of this) {
        if (current[0] !== null && !equals(elem, current[0])) {
            result.push(current[1]);
            current[1] = [];
        }
        current[0] = elem;
        current[1].push(elem);
    }
    if (!current[1].isEmpty()) {
        result.push(current[1]);
    }
    return result;
};

Array.prototype.groupByKey = function groupByForArray<B>(getKey: (_: any) => B) {
    const input = this.map((x) => [getKey(x), x] as [B, any]);
    const keys = input.map(([b, _]) => b).filter((b, i, arr) => arr.indexOf(b) === i);
    const result = [];
    for (const key of keys) {
        result.push([key, input.filter(([b, _]) => key === b).map(([_, x]) => x)] as [B, any]);
    }
    return result;
};

Array.prototype.head = function headForArray() {
    return this[0];
};

Array.prototype.init = function initForArray() {
    return this.isEmpty()
        ? undefined
        : this.slice(0, this.length - 1);
};

Array.prototype.inits = function initsForArray() {
    const result = [];
    for (let i = 0; i <= this.length; i++) {
        result.push(this.slice(0, i));
    }
    return result;
};

Array.prototype.intersperse = function intersperseForArray(separator) {
    const result = [];
    for (const elem of this) {
        result.push(elem, separator);
    }
    if (result.length > 0) {
        result.pop();
    }
    return result;
};

Array.prototype.isEmpty = function isEmptyForArray() {
    return this.length === 0;
};

Array.prototype.isInfixOf = function isInfixOfForArray(other) {
    if (this.isEmpty()) {
        return true;
    } else {
        let current = 0;
        for (const elem of other) {
            const toMatch = this[current++];
            if (elem !== toMatch) {
                current = 0;
            } else if (current === this.length) {
                break;
            }
        }
        return current === this.length;
    }
};

Array.prototype.containsRange = function containsRangeForArray(other) {
    return other.isInfixOf(this);
};

Array.prototype.isPrefixOf = function isPrefixOfForArray(other) {
    if (this.isEmpty()) {
        return true;
    } else if (this.length > other.length) {
        return false;
    } else {
        return this
            .zip(other)
            .all(([a, b]) => a === b);
    }
};

Array.prototype.startsWith = function startsWithForArray(other) {
    return other.isPrefixOf(this);
};

Array.prototype.isSuffixOf = function isSuffixOfForArray(other) {
    if (this.isEmpty()) {
        return true;
    } else if (this.length > other.length) {
        return false;
    } else {
        return this
            .zip(other.slice(other.length - this.length))
            .all(([a, b]) => a === b);
    }
};

Array.prototype.endsWith = function endsWithForArray(other) {
    return other.isSuffixOf(this);
};

Array.prototype.last = function lastForArray() {
    return this[this.length - 1];
};

Array.prototype.partition = function partitionForArray(p) {
    const trues = [];
    const falses = [];
    for (const elem of this) {
        if (p(elem)) {
            trues.push(elem);
        } else {
            falses.push(elem);
        }
    }
    return [trues, falses];
};

Array.prototype.scan = function scanForArray(reduce, seed) {
    const results = [seed];
    for (const a of this) {
        seed = reduce(seed, a);
        results.push(seed);
    }
    return results;
};

Array.prototype.scanRight = function scanRightForArray(reduce, seed) {
    const results = [seed];
    for (let i = this.length - 1; i >= 0; --i) {
        const element = this[i];
        seed = reduce(element, seed);
        results.push(seed);
    }
    return results;
};

Array.prototype.span = function spanForArray(p) {
    const front = [];
    const back = [];
    let i = 0;
    while (i < this.length && p(this[i])) {
        front.push(this[i++]);
    }
    while (i < this.length) {
        back.push(this[i++]);
    }
    return [front, back];
};

Array.prototype.splitAt = function splitAtForArray(n) {
    const clamped = Math.max(0, Math.min(this.length, n));
    return [this.slice(0, clamped), this.slice(clamped)];
};

Array.prototype.takeWhile = function takeWhileForArray(p) {
    let i = 0;
    const result = [];
    while (i < this.length && p(this[i])) {
        result.push(this[i++]);
    }
    return result;
};

Array.prototype.tail = function tailForArray() {
    return this.isEmpty()
        ? undefined
        : this.slice(1, this.length);
};

Array.prototype.tails = function tailsForArray() {
    const result = [];
    for (let i = 0; i <= this.length; i++) {
        result.push(this.slice(i, this.length));
    }
    return result;
};

Array.prototype.zip = function zipForArray(...arrs) {
    const length = minimum(arrs.map((x) => x.length).concat([this.length]));
    const result = [];
    for (let i = 0; i < length; i++) {
        result.push([this[i]].concat(arrs.map((x) => x[i])));
    }
    return result as any;
};

Array.prototype.zipWith = function zipWithForArray(f, ...arrs) {
    const length = minimum(arrs.map((x) => x.length).concat([this.length]));
    const result = [];
    for (let i = 0; i < length; i++) {
        result.push(f(this[i], ...arrs.map((x) => x[i]) as any));
    }
    return result;
};
