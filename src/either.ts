import {constant, id} from "./prelude";
import {unzip, zipWith} from "./array";

type EitherLeft<T> = { tag: "Left"; value: T };
type EitherRight<T> = { tag: "Right"; value: T  };
export type Either<A, B> = EitherLeft<A> | EitherRight<B>;

export function Left<A, B>(value: A): Either<A, B> {
    return { tag: "Left", value };
}

export function Right<A, B>(value: B): Either<A, B> {
    return { tag: "Right", value };
}

export function either<A, B, C>(left: (x: A) => C, right: (x: B) => C, e: Either<A, B>) : C {
    switch (e.tag) {
        case "Left": return left(e.value);
        case "Right": return right(e.value);
    }
}

export function lefts<A, B>(es: Either<A, B>[]): A[] {
    return es.reduce(
        (state, m) => [...state, ...either(x => [x], _ => [], m)],
        <A[]>[]);
}

export function rights<A, B>(es: Either<A, B>[]): B[] {
    return es.reduce(
        (state, m) => [...state, ...either(_ => [], x => [x], m)],
        <B[]>[]);
}

export function isLeft<A, B>(m:Either<A, B>) : m is EitherLeft<A> {
    return m.tag === "Left";
}

export function isRight<A, B>(m:Either<A, B>) : m is EitherRight<B> {
    return m.tag === "Right";
}

export function map<A, B, C>(f: (a: B) => C, m: Either<A, B>): Either<A, C> {
    switch (m.tag) {
        case "Left": return m;
        case "Right": return Right(f(m.value));
    }
}

export function pure<A, B>(value: B): Either<A, B> {
    return Right(value);
}

export function apply<A, B, C>(f: Either<A, (a: B) => C>, m: Either<A, B>): Either<A, C> {
    switch (f.tag) {
        case "Left": return f;
        case "Right":
            switch (m.tag) {
                case "Left": return m;
                case "Right": return pure(f.value(m.value));
                default: return m;
            }
    }
}

export function flatMap<A, B, C>(f: (a: B) => Either<A, C>, m: Either<A, B>): Either<A, C> {
    switch (m.tag) {
        case "Left": return m;
        case "Right": return f(m.value);
    }
}

export function replacePure<A, B, C>(e: Either<A, B>, c: C) : Either<A, C> {
    return map(constant(c), e);
}

export function replace<A, B, C>(e: Either<A, B>, c: Either<A, C>) : Either<A, C> {
    return flatMap(constant(c), e);
}

export function voidOut<A, B>(e: Either<A, B>) : Either<A, []> {
    return replacePure(e, []);
}

export function lift2<A, B, C, D>(f: (b: B, c: C) => D): (b: Either<A, B>, c: Either<A, C>) => Either<A, D> {
    return (e1, e2) => flatMap(a => map(b => f(a, b), e2), e1);
}

export function lift3<A, B, C, D, E>(f: (b: B, c: C, d: D) => E): (b: Either<A, B>, c: Either<A, C>, d: Either<A, D>) => Either<A, E> {
    return (e1, e2, e3) => flatMap(a => flatMap(b => map(c => f(a, b, c), e3), e2), e1);
}

export function lift4<A, B, C, D, E, F>(f: (b: B, c: C, d: D, e: E) => F): (b: Either<A, B>, c: Either<A, C>, d: Either<A, D>, e: Either<A, E>) => Either<A, F> {
    return (e1, e2, e3, e4) => flatMap(a => flatMap(b => flatMap(c => map(d => f(a, b, c, d), e4), e3), e2), e1);
}

export function mapM<A, B, C>(f: (value: B) => Either<A, C>, bs: B[]): Either<A, C[]> {
    return bs.reduce(
        (mcs, b) => lift2<A, C[], C, C[]>((cs, c) => [...cs, c])(mcs, f(b)),
        pure<A, C[]>([]));
}

export function mapM_<A, B, C>(f: (value: B) => Either<A, C>, bs: B[]): Either<A, []> {
    return voidOut(mapM(f, bs));
}

export function forM<A, B, C>(bs: B[], f: (value: B) => Either<A, C>): Either<A, C[]> {
    return bs.reduce(
        (mbs, a) => flatMap(cs => map(b => [...cs, b], f(a)), mbs),
        pure<A, C[]>([]));
}

export function forM_<A, B, C>(bs: B[], f: (value: B) => Either<A, C>): Either<A, []> {
    return voidOut(forM(bs, f));
}

export function sequence<A, B>(bs: Either<A, B>[]): Either<A, B[]> {
    return mapM(id, bs);
}

export function sequence_<A, B>(bs: Either<A, B>[]): Either<A, []> {
    return voidOut(sequence(bs));
}

export function join<A, B>(m: Either<A, Either<A, B>>): Either<A, B> {
    return flatMap(id, m);
}

export function mapAndUnzipWith<A, B, C, D>(f: (a: B) => Either<A, [C, D]>, bs: B[]): Either<A, [C[], D[]]> {
    return map(unzip, mapM(f, bs));
}

export function zipWithM<A, B, C, D>(f: (b: B, c: C) => Either<A, D>, bs: B[], cs: C[]): Either<A, D[]> {
    return sequence(zipWith(f, bs, cs));
}

export function zipWithM_<A, B, C, D>(f: (b: B, c: C) => Either<A, D>, bs: B[], cs: C[]): Either<A, []> {
    return voidOut(zipWithM(f, bs, cs));
}

export function reduceM<A, B, C>(f: (state: C, b: B) => Either<A, C>, seed: C, bs: B[]): Either<A, C> {
    return bs.reduce(
        (state, a) => flatMap(b => f(b, a), state),
        pure<A, C>(seed));
}

export function reduceM_<A, B, C>(f: (state: C, b: B) => Either<A, C>, seed: C, bs: B[]): Either<A, []> {
    return voidOut(reduceM(f, seed, bs));
}

export function replicate<A, B>(n: number, m: Either<A, B>): Either<A, B[]> {
    const arr = [];
    for (let i = 0; i < n; ++i) {
        arr.push(m);
    }
    return sequence(arr);
}

export function replicate_<A, B>(n: number, m: Either<A, B>): Either<A, []> {
    return voidOut(replicate(n, m));
}

export function when<A>(b: boolean, e: Either<A, []>): Either<A, []> {
    return b ? e : pure([]);
}

export function unless<A>(b: boolean, e: Either<A, []>): Either<A, []> {
    return when(!b, e);
}
