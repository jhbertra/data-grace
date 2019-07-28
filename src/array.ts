/**
 * Map a function over the elements of two arrays in order and return
 * array containing the combined results.
 * 
 * @param f a merge function that combines the elements of the two argument arrays
 * @param as the first array to zip
 * @param bs the second array to zip
 */
export function zipWith<A, B, C>(f: (a: A, b: B) => C, as: A[], bs: B[]): C[] {
    let results: C[] = []
    let alen = as.length;
    let blen = bs.length;

    for (let i = 0; i < alen && i < blen; ++i) {
        results.push(f(as[i], bs[i]));
    }

    return results;
}

/**
 * Take a list of tuples and transform it into a tuple of lists.
 * 
 * @param abs the array to unzip
 */
export function unzip<A, B>(abs: [A, B][]): [A[], B[]] {
    let as: A[] = [];
    let bs: B[] = [];
    let len = abs.length;

    for (let i = 0; i < len; ++i) {
        const [a, b] = abs[i];
        as.push(a);
        bs.push(b);
    }
    
    return [as, bs];
}