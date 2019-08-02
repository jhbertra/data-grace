export {
    IArrayExtensions,
    Cons,
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

type Cons<A, Tail extends any[]> = ((a: A, ...t: Tail) => any) extends ((...tail: infer TT) => any) ? TT : never;

interface IArrayExtensions<A> {
    all(p: (a: A) => boolean): boolean;
    any(p: (a: A) => boolean): boolean;
    break(p: (a: A) => boolean): [A[], A[]];
    chain<B>(f: (a: A) => B[]): B[];
    contains(a: A): boolean;
    distinct(): A[];
    distinctBy(equals: (a: A, b: A) => boolean): A[];
    dropWhile(p: (a: A) => boolean): A[];
    group(): A[][];
    groupBy(equals: (a: A, b: A) => boolean): A[][];
    groupByKey<B>(getKey: (a: A) => B): Array<[B, A[]]>;
    head(): A | undefined;
    init(): A[] | undefined;
    inits(): A[][];
    intersperse(t: A): A[];
    isEmpty(): boolean;
    isInfixOf(other: A[]): boolean;
    isInfixedBy(other: A[]): boolean;
    isPrefixOf(other: A[]): boolean;
    isPrefixedBy(other: A[]): boolean;
    isSuffixOf(other: A[]): boolean;
    isSuffixedBy(other: A[]): boolean;
    last(): A | undefined;
    partition(p: (a: A) => boolean): [A[], A[]];
    scan<B>(reduce: (b: B, a: A) => B, seed: B): B[];
    scanRight<B>(reduce: (a: A, b: B) => B, seed: B): B[];
    span(p: (a: A) => boolean): [A[], A[]];
    splitAt(index: number): [A[], A[]];
    takeWhile(p: (a: A) => boolean): A[];
    tail(): A[] | undefined;
    tails(): A[][];
    zip<P extends any[]>(...arr: MapArray<P>): Array<Cons<A, P>>;

    /**
     * Map a function over the elements of multiple arrays in order and return an
     * array containing the combined results.
     *
     * @param f a merge function that combines the elements of the  argument arrays
     */
    zipWith<P extends any[], B>(f: (a: A, ...p: P) => B, ...arr: MapArray<P>): B[];
}

/**
 * A type transformer that homomorphically maps the @see Array type
 * onto the types of A.
 */
type MapArray<A> = { [K in keyof A]: Array<A[K]> };

/**
 * Returns the conjunction of an array of booleans.
 * Returns true if the array is empty.
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
 */
function intercalate<A>(seperator: A[], arrays: A[][]): A[] {
    return ([] as A[]).concat(...arrays.intersperse(seperator));
}

/**
 * Returns the largest element in the array.
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
 * @param abs the array to unzip
 */
function unzip<N extends number, P extends any[] & { length: N }>(n: N, input: P[]): MapArray<P> {
    const result = [];
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

declare global {
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

Array.prototype.intersperse = function intersperseForArray(seperator) {
    const result = [];
    for (const elem of this) {
        result.push(elem, seperator);
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

Array.prototype.isInfixedBy = function isInfixedByForArray(other) {
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

Array.prototype.isPrefixedBy = function isPrefixedByForArray(other) {
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

Array.prototype.isSuffixedBy = function isSuffixedByForArray(other) {
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
