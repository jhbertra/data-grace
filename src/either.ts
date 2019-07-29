import {unzip, zipWith} from "./array";
import {constant, id, objectFromEntries, objectToEntries} from "./prelude";

/*------------------------------
  DATA TYPES
  ------------------------------*/

/**
 * The public methods exposed by the {@link Either} type.
 */
export interface IEither<A, B> {
    /**
     * Extract the value of this @see Either if it is @see Left, or default to a.
     *
     * @example
     *
     *      Right<boolean, string>("foo").defaultLeftWith(true); // true
     *      Left<boolean, string>(false).defaultLeftWith(true); // false
     */
    readonly defaultLeftWith: (a: A) => A;

    /**
     * Extract the value of this @see Either if it is @see Right, or default to b.
     *
     * @example
     *
     *      Right<boolean, string>("foo").defaultRightWith("bar"); // "foo"
     *      Left<boolean, string>(false).defaultRightWith("bar"); // "bar"
     */
    readonly defaultRightWith: (b: B) => B;

    /**
     * If this @see Either is a @see Right use its value to compute the next @see Either.
     * Used to compose 2-track pipelines with a short-circuit option.
     *
     * @example
     *
     *      const result = Right("Bob")
     *          .flatMap(name => name === "Jim" ? Right({ agentId: 12 }) : Left("Not Authorized"))
     *          .flatMap(({agentId}) => agentId > 15 ? Right("Access granted") : Left("Access denied"));
     *
     *     result.toString() // "Left (Not Authorized)"
     */
    readonly flatMap: <C>(f: (b: B) => Either<A, C>) => Either<A, C>;

    /**
     * A type guard which determines if this @see Either is a @see Left
     *
     * @example
     *
     *      const result = Left("error");
     *      if (result.isLeft()) {
     *          result.value; // "error";
     *      }
     */
    readonly isLeft: () => this is EitherLeft<A>;

    /**
     * A type guard which determines if this @see Either is a @see Right
     *
     * @example
     *
     *      const result = Right("Bob");
     *      if (result.isRight()) {
     *          result.value; // "Bob";
     *      }
     */
    readonly isRight: () => this is EitherRight<A>;

    /**
     * Modify the data in the @see Right case.
     *
     * @example
     *
     *     Right("bob").map(name => name.toUpperCase()).toString(); // "Right (BOB)"
     *     Left("error").map(name => name.toUpperCase()).toString(); // "Left (error)"
     */
    readonly map: <C>(f: (b: B) => C) => Either<A, C>;

    /**
     * Modify the data in the @see Left case.
     *
     * @example
     *
     *     Right("bob").mapLeft(name => name.toUpperCase()).toString(); // "Right (bob)"
     *     Left("error").mapLeft(name => name.toUpperCase()).toString(); // "Left (ERROR)"
     */
    readonly mapLeft: <C>(f: (a: A) => C) => Either<C, B>;

    /**
     * Run a callback based on the case of the @see Either
     *
     * @example
     *
     *     Right<boolean, string>("bob").matchCase({
     *          left: x => x ? "Yes" : "No",
     *          right: x => x.toUpperCase()); // "BOB"
     *
     *     Left<boolean, string>(false).matchCase({
     *          left: x => x ? "Yes" : "No",
     *          right: x => x.toUpperCase()); // "No"
     */
    readonly matchCase: <C>(cases: EitherCaseScrutinizer<A, B, C>) => C;

    /**
     * Pick this @Either if it is @see Right otherwise pick the other.
     *
     * @example
     *
     *     Right("bob").or(() => Right("sue")).toString(); // "Right (bob)"
     *     Left(false).or(() => Right("sue")).toString(); // "Right (sue)"
     *     Left(false).or(() => Left(true)).toString(); // "Left (true)"
     */
    readonly or: (other: () => Either<A, B>) => Either<A, B>;

    /**
     * If this @Either is @see Right replace it with a different @see Either.
     *
     * @example
     *
     *     Right("bob").replace(Right("sue")).toString(); // "Right (sue)"
     *     Right("bob").replace(Left(true)).toString(); // "Left (true)"
     *     Left(false).replace(Right("sue")).toString(); // "Left (false)"
     *     Left(false).replace(Left(true)).toString(); // "Left (false)"
     */
    readonly replace: <C>(m: Either<A, C>) => Either<A, C>;

    /**
     * If this @Either is @see Right replace it with a pure value.
     *
     * @example
     *
     *     Right("bob").replace(42).toString(); // "Right (42)"
     *     Left(false).replace(42).toString(); // "Left (false)"
     */
    readonly replacePure: <C>(c: C) => Either<A, C>;

    /**
     * Discard the value in the @see Either.
     *
     * @example
     *
     *     Right("bob").voidOut().toString(); // "Right ([])"
     *     Left(false).voidOut().toString(); // "Left (false)"
     */
    readonly voidOut: () => Either<A, []>;
}

/**
 * Defines the set of functions required to scrutinize the cases of an @see Either.
 */
type EitherCaseScrutinizer<A, B, C> = {
    /**
     * Callback which is called in the case of a @see Left.
     */
    left: (a: A) => C,

    /**
     * Callback which is called in the case of a @see Right.
     */
    right: (b: B) => C,
};
type EitherLeft<A> = { tag: "Left", value: A };
type EitherRight<B> = { tag: "Right",  value: B };
export type Either<A, B> = (EitherLeft<A> | EitherRight<B>) & IEither<A, B>;
export type MapEither<A, B> = { [K in keyof B]: Either<A, B[K]> };

/*------------------------------
  CONSTRUCTORS
  ------------------------------*/

/**
 * Constructs a new @see Either resolved to the @see Left case using
 * the given value.
 */
export function Left<A, B>(value: A): Either<A, B> {
    return  Object.freeze({
        defaultLeftWith: constant(value),
        defaultRightWith: id,
        flatMap: (_) => Left<A, B>(value),
        isLeft: constant(true),
        isRight: constant(false),
        map: (_) => Left(value),
        mapLeft: (f) => Left(f(value)),
        matchCase: ({left}) => left(value),
        or: (x) => x(),
        replace: (_) => Left(value),
        replacePure: (_) => Left(value),
        tag: "Left",
        toString: () => `Left (${value})`,
        value,
        voidOut: () => Left<A, []>(value),
    }) as Either<A, B>;
}

/**
 * Constructs a new @see Either resolved to the @see Right case using
 * the given value.
 */
export function Right<A, B>(value: B): Either<A, B> {
    return  Object.freeze({
        defaultLeftWith: id,
        defaultRightWith: constant(value),
        flatMap: (f) => f(value),
        isLeft: constant(false),
        isRight: constant(true),
        map: (f) => Right(f(value)),
        mapLeft: (_) => Right(value),
        matchCase: ({right}) => right(value),
        or: (_) => Right(value),
        replace: id,
        replacePure: Right,
        tag: "Right",
        toString: () => `Right (${value})`,
        value,
        voidOut: () => Right<A, []>([]),
    }) as Either<A, B>;
}

/*------------------------------
  EITHER FUNCTIONS
  ------------------------------*/

/**
 * Filter out all the @see Right cases.
 *
 * @example
 *
 *     lefts(Right("bob"), Left("error"), Right("sue")); // ["error"]
 */
export function lefts<A, B>(es: Array<Either<A, B>>): A[] {
    return es.reduce(
        (state, m) => [...state, ...m.matchCase({left: (x) => [x], right: () => []})],
         [] as A[]);
}

/**
 * Filter out all the @see Left cases.
 *
 * @example
 *
 *     lefts(Right("bob"), Left("error"), Right("sue")); // ["bob", "sue"]
 */
export function rights<A, B>(es: Array<Either<A, B>>): B[] {
    return es.reduce(
        (state, m) => [...state, ...m.matchCase({left: () => [], right: (x) => [x]})],
         [] as B[]);
}

/*------------------------------
  GENERAL LIFTING FUNCTIONS
  ------------------------------*/

/**
 * Composes an Either by applying a function to each argument
 * if they are all @see Right
 *
 * In order to satisfy the consistency of results between
 *
 * liftF(f, e1, e2) == e1.flatMap(v1 => e2.map(v2 => f(v1, v2)));
 *
 * The first failure will be returned. For a similar structure that
 * aggregates failures, @see Validation which does not provide and implementaion of @see flatMap
 *
 * @example
 *
 *      function answerTrueFalse(question: string, answer: boolean): string {
 *          return `${question} ${answer}`;
 *      }
 *
 *      liftF(answerTrueFalse, Left("error1"), Left("error2")).toString(); // "Left (error2)"
 *      liftF(answerTrueFalse, Right("The meaning of life is 42."), Left("error2")).toString(); // "Left (error2)"
 *      // "Right (The meaning of life is 42. true)"
 *      liftF(answerTrueFalse, Right("The meaning of life is 42."), Right(true)).toString();
 */
export function liftF<A, P extends any[], R>(f: (...args: P) => R, ...args: MapEither<A, P>): Either<A, R> {
    const errors = lefts(args);

    return errors.length === 0
        ? Right(f.apply(undefined,  rights(args) as P))
        : Left(errors[0]);
}

export function liftO<A, T extends object>(spec: MapEither<A, T>): Either<A, T> {
    const maybeKvps = sequence(objectToEntries(spec).map(
        ([key, value]) => value.map((x) =>  [key, x] as [keyof T, T[typeof key]])));

    return maybeKvps.map(objectFromEntries);
}

/*------------------------------
  KLIESLI COMPOSITION FUNCTIONS
  ------------------------------*/

export function mapM<A, B, C>(f: (value: B) => Either<A, C>, bs: B[]): Either<A, C[]> {
    return sequence(bs.map(f));
}

export function forM<A, B, C>(bs: B[], f: (value: B) => Either<A, C>): Either<A, C[]> {
    return mapM(f, bs);
}

export function sequence<A, B>(ebs: Array<Either<A, B>>): Either<A, B[]> {
    return liftF((...bs: B[]) => bs, ...ebs);
}

export function mapAndUnzipWith<A, B, C, D>(f: (a: B) => Either<A, [C, D]>, bs: B[]): Either<A, [C[], D[]]> {
    return mapM(f, bs).map(unzip);
}

export function zipWithM<A, B, C, D>(f: (b: B, c: C) => Either<A, D>, bs: B[], cs: C[]): Either<A, D[]> {
    return sequence(zipWith(f, bs, cs));
}

export function reduceM<A, B, C>(f: (state: C, b: B) => Either<A, C>, seed: C, bs: B[]): Either<A, C> {
    return bs.reduce(
        (state, a) => state.flatMap((b) => f(b, a)),
        Right<A, C>(seed));
}

/*------------------------------
  GENERAL MONAD FUNCTIONS
  ------------------------------*/

export function join<A, B>(m: Either<A, Either<A, B>>): Either<A, B> {
    return m.flatMap(id);
}

export function when<A>(b: boolean, e: Either<A, []>): Either<A, []> {
    return b ? e : Right([]);
}

export function unless<A>(b: boolean, e: Either<A, []>): Either<A, []> {
    return when(!b, e);
}
