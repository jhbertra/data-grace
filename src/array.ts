export {
    unzip,
    zipWith,
};

declare global {
    // tslint:disable-next-line:interface-name
    interface Array<T> {
        flatMap<B>(f: (t: T) => B[]): B[];
    }
}

Array.prototype.flatMap = function flatMapForArray<B>(f: (t: any) => B[]): B[] {
    const result: B[] = [];
    for (const bs of this.map(f)) {
        for (const b of bs) {
            result.push(b);
        }
    }
    return result;
};

/**
 * Take a list of tuples and transform it into a tuple of lists.
 *
 * @param abs the array to unzip
 */
function unzip<A, B>(abs: Array<[A, B]>): [A[], B[]] {
    const as: A[] = [];
    const bs: B[] = [];
    const len = abs.length;

    for (let i = 0; i < len; ++i) {
        const [a, b] = abs[i];
        as.push(a);
        bs.push(b);
    }

    return [as, bs];
}

/**
 * Map a function over the elements of two arrays in order and return
 * array containing the combined results.
 *
 * @param f a merge function that combines the elements of the two argument arrays
 * @param as the first array to zip
 * @param bs the second array to zip
 */
function zipWith<A, B, C>(f: (a: A, b: B) => C, as: A[], bs: B[]): C[] {
    const results: C[] = [];
    const alen = as.length;
    const blen = bs.length;

    for (let i = 0; i < alen && i < blen; ++i) {
        results.push(f(as[i], bs[i]));
    }

    return results;
}
