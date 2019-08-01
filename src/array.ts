export {
    IArrayExtensions,
    MapArray,
    and,
    intercalate,
    maximum,
    minimum,
    or,
    replicate,
    sum,
    product,
    unzip,
};

type Cons<A, Tail extends any[]> = ((a: A, ...t: Tail) => any) extends ((...tail: infer TT) => any) ? TT : never;

interface IArrayExtensions<A> {
    all(p: (a: A) => boolean): boolean;
    any(p: (a: A) => boolean): boolean;
    break(p: (a: A) => boolean): [A[], A[]];
    chain<B>(f: (a: A) => B[]): B[];
    contains(a: A): boolean;
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
    scan<B>(reduce: (b: B, a: A) => B): B[];
    scanRight<B>(reduce: (a: A, b: B) => B): B[];
    span(p: (a: A) => boolean): [A[], A[]];
    splitAt(index: number): [A[], A[]];
    takeWhile(p: (a: A) => boolean): A[];
    tail(): A[];
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

declare global {
    // tslint:disable-next-line:interface-name
    interface Array<T> extends IArrayExtensions<T> { }
}

Array.prototype.chain = function chainForArray<B>(f: (t: any) => B[]): B[] {
    const result: B[] = [];
    for (const bs of this.map(f)) {
        for (const b of bs) {
            result.push(b);
        }
    }
    return result;
};

function and(bools: boolean[]): boolean {
    let result = true;
    for (const b of bools) {
        result = result && b;
    }
    return result;
}

function intercalate<A>(seperator: A[], arrays: A[][]): A[] {
    return ([] as A[]).concat(...arrays.intersperse(seperator));
}

function maximum(nums: number[]): number {
    let result = Number.MIN_VALUE;
    for (const num of nums) {
        if (num > result) {
            result = num;
        }
    }
    return result;
}

function minimum(nums: number[]): number {
    let result = Number.MAX_VALUE;
    for (const num of nums) {
        if (num < result) {
            result = num;
        }
    }
    return result;
}

function or(bools: boolean[]): boolean {
    let result = false;
    for (const b of bools) {
        result = result || b;
    }
    return result;
}

function replicate<A>(times: number, a: A | A[]): A[] {
    const toRepeat = Array.isArray(a) ? a : [a];
    let result: A[] = [];
    for (let i = 0; i < times; i++) {
        result = result.concat(toRepeat);
    }
    return result;
}

function sum(nums: number[]): number {
    let result = 0;
    for (const num of nums) {
        result += num;
    }
    return result;
}

function product(nums: number[]): number {
    let result = 1;
    for (const num of nums) {
        result *= num;
    }
    return result;
}

/**
 * Take a list of tuples and transform it into a tuple of lists.
 *
 * @param abs the array to unzip
 */
function unzip<N extends number, P extends any[] & { length: N }>(n: N, input: P[]): MapArray<P> {
    const result = replicate(n, []) as unknown as MapArray<P>;
    for (const tuple of input) {
        for (let i = 0; i < tuple.length; i++) {
            const element = tuple[i];
            const bucket = result[i];
            bucket.push(element);
        }
    }
    return result;
}
