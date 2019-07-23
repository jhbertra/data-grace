import {unzip, zipWith} from "./array";
import {constant, id} from "./prelude";

type EitherCaseScrutinizer<A, B, C> = {
    left: (a: A) => C,
    right: (b: B) => C
}

export interface IEither<A, B> {
    readonly defaultLeftWith: (a: A) => A,
    readonly defaultRightWith: (b: B) => B,
    readonly flatMap: <C>(f: (b: B) => Either<A, C>) => Either<A, C>,
    readonly map: <C>(f: (b: B) => C) => Either<A, C>,
    readonly mapLeft: <C>(f: (a: A) => C) => Either<C, B>,
    readonly matchCase: <C>(cases: EitherCaseScrutinizer<A, B, C>) => C,
    readonly or: (other: () => Either<A, B>) => Either<A, B>,
    readonly replace: <C>(m: Either<A, C>) => Either<A, C>,
    readonly replacePure: <C>(c: C) => Either<A, C>,
    readonly voidOut: () => Either<A, []>
}

type EitherLeft<A> = { tag: "Left", value: A };
type EitherRight<B> = { tag: "Right",  value: B };
export type Either<A, B> = (EitherLeft<A> | EitherRight<B>) & IEither<A, B>;

export function Left<A, B>(value: A): Either<A, B> {
    return Object.freeze({ 
        tag: "Left",
        value,
        defaultLeftWith: constant(value),
        defaultRightWith: id,
        flatMap: constant(Left(value)),
        map: constant(Left(value)),
        mapLeft: f => Left(f(value)),
        matchCase: ({left}) => left(value),
        or: x => x(),
        replace: constant(Left(value)),
        replacePure: constant(Left(value)),
        voidOut: () => Left<A, []>(value)
    });
}

export function Right<A, B>(value: B) : Either<A, B> {
    return Object.freeze({
        tag: "Right",
        value,
        defaultLeftWith: id,
        defaultRightWith: constant(value),
        flatMap: f => f(value),
        map: f => Right(f(value)),
        mapLeft: constant(Right(value)),
        matchCase: ({right}) => right(value),
        or: constant(Right(value)),
        replace: id,
        replacePure: Right,
        voidOut: () => Right<A, []>([])
    });
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

export function isLeft<A, B>(m:Either<A, B>) : m is EitherLeft<A> & IEither<A, B> {
    return m.tag === "Left";
}

export function isRight<A, B>(m:Either<A, B>) : m is EitherRight<B> & IEither<A, B> {
    return m.tag === "Right";
}

export function pure<A, B>(value: B): Either<A, B> {
    return Right(value);
}

export function apply<A, B, C>(f: Either<A, (a: B) => C>, m: Either<A, B>): Either<A, C> {
    switch (f.tag) {
        case "Left": return Left(f.value);
        case "Right":
            switch (m.tag) {
                case "Left": return Left(m.value);
                case "Right": return pure(f.value(m.value));
                default: return m;
            }
    }
}

export function lift2<A, B, C, D>(f: (b: B, c: C) => D): (b: Either<A, B>, c: Either<A, C>) => Either<A, D> {
    const fcurried = (b: B) => (c: C) => f(b, c);
    return (e1, e2) => apply(e1.map(fcurried), e2);
}

export function lift3<A, B, C, D, E>(f: (b: B, c: C, d: D) => E): (b: Either<A, B>, c: Either<A, C>, d: Either<A, D>) => Either<A, E> {
    const fcurried = (b: B) => (c: C) => (d: D) => f(b, c, d);
    return (e1, e2, e3) => apply(apply(e1.map(fcurried), e2), e3);
}

export function lift4<A, B, C, D, E, F>(f: (b: B, c: C, d: D, e: E) => F): (b: Either<A, B>, c: Either<A, C>, d: Either<A, D>, e: Either<A, E>) => Either<A, F> {
    const fcurried = (b: B) => (c: C) => (d: D) => (e: E) => f(b, c, d, e);
    return (e1, e2, e3, e4) => apply(apply(apply(e1.map(fcurried), e2), e3), e4);
}

export function mapM<A, B, C>(f: (value: B) => Either<A, C>, bs: B[]): Either<A, C[]> {
    return bs.reduce(
        (mcs, b) => lift2<A, C[], C, C[]>((cs, c) => [...cs, c])(mcs, f(b)),
        pure<A, C[]>([]));
}

export function mapM_<A, B, C>(f: (value: B) => Either<A, C>, bs: B[]): Either<A, []> {
    return mapM(f, bs).voidOut();
}

export function forM<A, B, C>(bs: B[], f: (value: B) => Either<A, C>): Either<A, C[]> {
    return bs.reduce(
        (mbs, a) => mbs.flatMap(cs => f(a).map(b => [...cs, b])),
        pure<A, C[]>([]));
}

export function forM_<A, B, C>(bs: B[], f: (value: B) => Either<A, C>): Either<A, []> {
    return forM(bs, f).voidOut();
}

export function sequence<A, B>(bs: Either<A, B>[]): Either<A, B[]> {
    return mapM(id, bs);
}

export function sequence_<A, B>(bs: Either<A, B>[]): Either<A, []> {
    return sequence(bs).voidOut();
}

export function join<A, B>(m: Either<A, Either<A, B>>): Either<A, B> {
    return m.flatMap(id);
}

export function mapAndUnzipWith<A, B, C, D>(f: (a: B) => Either<A, [C, D]>, bs: B[]): Either<A, [C[], D[]]> {
    return mapM(f, bs).map(unzip);
}

export function zipWithM<A, B, C, D>(f: (b: B, c: C) => Either<A, D>, bs: B[], cs: C[]): Either<A, D[]> {
    return sequence(zipWith(f, bs, cs));
}

export function zipWithM_<A, B, C, D>(f: (b: B, c: C) => Either<A, D>, bs: B[], cs: C[]): Either<A, []> {
    return zipWithM(f, bs, cs).voidOut();
}

export function reduceM<A, B, C>(f: (state: C, b: B) => Either<A, C>, seed: C, bs: B[]): Either<A, C> {
    return bs.reduce(
        (state, a) => state.flatMap(b => f(b, a)),
        pure<A, C>(seed));
}

export function reduceM_<A, B, C>(f: (state: C, b: B) => Either<A, C>, seed: C, bs: B[]): Either<A, []> {
    return reduceM(f, seed, bs).voidOut();
}

export function replicate<A, B>(n: number, m: Either<A, B>): Either<A, B[]> {
    const arr = [];
    for (let i = 0; i < n; ++i) {
        arr.push(m);
    }
    return sequence(arr);
}

export function replicate_<A, B>(n: number, m: Either<A, B>): Either<A, []> {
    return replicate(n, m).voidOut();
}

export function when<A>(b: boolean, e: Either<A, []>): Either<A, []> {
    return b ? e : pure([]);
}

export function unless<A>(b: boolean, e: Either<A, []>): Either<A, []> {
    return when(!b, e);
}
