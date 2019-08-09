export {
    Cons,
    Curry,
    Equals,
    Head,
    IsEmpty,
    Tail,
};

/**
 * Create a new tuple type by prepending `THead` to the start.
 *
 * @example
 *
 *  Cons<string, [number, boolean]> == [string, number, boolean]
 */
type Cons<THead, TTail extends any[]> =
    ((a: THead, ...t: TTail) => any) extends ((...tail: infer TT) => any) ? TT : never;

/**
 * Take a function type with any number of known parameters and
 * return a curried version (a single-parameter function that continues
 * to return single-parameters functions until all arguments have been supplied).
 *
 * @example
 *
 *  Curry<[string, boolean, number], string> == (arg: string) => (arg: boolean) => (arg: number) => string
 */
type Curry<TParams extends any[], TReturn> =
    (arg: Head<TParams>) => IsEmpty<TParams> extends true ? TReturn : Curry<Tail<TParams>, TReturn>;

/**
 * A type which proposes equality between two types.
 * If the proposition is true, it can be assigned a
 * value of any type.
 *
 * @example
 *
 *  Equals<string, string> == any
 *  Equals<string, number> == never
 */
type Equals<A, B> = A extends B ? B extends A ? any : never : never;

/**
 * Return the first element of a tuple type.
 *
 * @example
 *
 *  Head<[string, number, boolean]> = string
 *  Head<[]> = never
 */
type Head<T extends any[]> = T extends [infer THead, ...any[]] ? THead : never;

/**
 * Determines if a tuple type is empty.
 *
 * @example
 *
 *  IsEmpty<[string, number, boolean]> = false
 *  IsEmpty<[]> = true
 */
type IsEmpty<T extends any[]> = T extends ([] | [any]) ? true : false;

/**
 * Return all but the first element of a tuple type.
 *
 * @example
 *
 *  Tail<[string, number, boolean]> = [number, boolean]
 */
type Tail<T extends any[]> =
    ((...t: T) => any) extends ((_: any, ...tail: infer TT) => any) ? TT : never;
