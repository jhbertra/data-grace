export function zipWith<A, B, C>(f: (a: A, b: B) => C, as: A[], bs: B[]): C[] {
    let results: C[] = []
    let alen = as.length;
    let blen = bs.length;

    for (let i = 0; i < alen && i < blen; ++i) {
        results.push(f(as[i], bs[i]));
    }

    return results;
}

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