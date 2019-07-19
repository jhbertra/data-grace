export function zipWith<A, B, C>(f: (a: A, b: B) => C, as: A[], bs: B[]): C[] {
    if (as.length === 0 || bs.length === 0) {
        return [];
    } else {
        return [f(as[0], bs[0]), ...zipWith(f, as.slice(1), bs.slice(1))];
    }
}

export function unzip<A, B>(abs: [A, B][]): [A[], B[]] {
    return abs.reduce(([as, bs], [a, b]) => [[...as, a],[...bs, b]], <[A[], B[]]>[[],[]]);
}