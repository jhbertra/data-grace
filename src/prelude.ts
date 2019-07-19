export function id<T>(t: T) : T {
    return t;
}

export function constant<T1, T2>(t: T1) : (_: T2) => T1 {
    return _ => t;
}