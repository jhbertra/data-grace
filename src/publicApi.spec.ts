// tslint:disable: max-line-length
import * as p from "../package.json";
import * as array from "./array";
import * as codec from "./codec";
import * as decoder from "./decoder";
import * as either from "./either";
import * as encoder from "./encoder";
import * as index from "./index";
import * as maybe from "./maybe";
import { Equals, prove } from "./prelude";
import * as prelude from "./prelude";
import * as promise from "./promise";
import * as validation from "./validation";

describe("package.json", () => {
  it("Is on version 0.0.0", () => {
    expect(p.version).toEqual("0.0.0");
  });
});

function requireMajor<T extends string>(api: T): T | "Detected breaking change. This required a MAJOR update." {
  return api;
}

function requireMinor<T extends string>(api: T): T | "Detected non-breaking change. This required a MINOR update."  {
  return api;
}

/*------------------------------
  INDEX
  ------------------------------*/

prove<Equals<
  typeof index,
  typeof prelude & {
    array: typeof array,
    codec: typeof codec,
    decoder: typeof decoder,
    either: typeof either,
    encoder: typeof encoder,
    maybe: typeof maybe,
    promise: typeof promise,
    validation: typeof validation,
  }
>>(requireMinor("root API"));

/*------------------------------
  ARRAY API
  ------------------------------*/

prove<Equals<typeof array.unzip, <A, B>(abs: Array<[A, B]>) => [A[], B[]]>>(requireMajor("array.unzip"));
prove<Equals<typeof array.zipWith, <A, B, C>(f: (a: A, b: B) => C, as: A[], bs: B[]) => C[]>>(requireMajor("array.zipWith"));
prove<Equals<typeof array, { unzip: typeof array.unzip, zipWith: typeof array.zipWith }>>(requireMinor("array API"));

/*------------------------------
  EITHER API
  ------------------------------*/

prove<Equals<typeof either.Left, <L, A>(value: L) => either.Either<L, A>>>(requireMajor("either.Left"));
prove<Equals<typeof either.Right, <L, A>(value: A) => either.Either<L, A>>>(requireMajor("either.Right"));
prove<Equals<typeof either.build, <L, T extends object>(spec: either.MapEither<L, T>) => either.Either<L, T>>>(requireMajor("either.build"));
prove<Equals<typeof either.forM, <L, A, B>(as: A[], f: (a: A) => either.Either<L, B>) => either.Either<L, B[]>>>(requireMajor("either.forM"));
prove<Equals<typeof either.join, <L, A>(_: either.Either<L, either.Either<L, A>>) => either.Either<L, A>>>(requireMajor("either.join"));
prove<Equals<typeof either.lefts, <L, A>(ms: Array<either.Either<L, A>>) => L[]>>(requireMajor("either.lefts"));
prove<Equals<typeof either.lift, <L, P extends any[], R>(f: (...args: P) => R, ...args: either.MapEither<L, P>) => either.Either<L, R>>>(requireMajor("either.lift"));
prove<Equals<typeof either.mapAndUnzipWith, <L, A, B, C>(f: (a: A) => either.Either<L, [B, C]>, as: A[]) => either.Either<L, [B[], C[]]>>>(requireMajor("either.mapAndUnzipWith"));
prove<Equals<typeof either.mapM, <L, A, B>(f: (a: A) => either.Either<L, B>, as: A[]) => either.Either<L, B[]>>>(requireMajor("either.mapM"));
prove<Equals<typeof either.reduceM, <L, A, B>(f: (state: B, a: A) => either.Either<L, B>, seed: B, as: A[]) => either.Either<L, B>>>(requireMajor("either.reduceM"));
prove<Equals<typeof either.rights, <L, A>(ms: Array<either.Either<L, A>>) => A[]>>(requireMajor("either.rights"));
prove<Equals<typeof either.sequence, <L, A>(mas: Array<either.Either<L, A>>) => either.Either<L, A[]>>>(requireMajor("either.sequence"));
prove<Equals<typeof either.unless, <L>(b: boolean, e: either.Either<L, []>) => either.Either<L, []>>>(requireMajor("either.unless"));
prove<Equals<typeof either.when, <L>(b: boolean, e: either.Either<L, []>) => either.Either<L, []>>>(requireMajor("either.when"));
prove<Equals<typeof either.zipWithM, <L, A, B, C>(f: (a: A, b: B) => either.Either<L, C>, as: A[], bs: B[]) => either.Either<L, C[]>>>(requireMajor("either.zipWithM"));
prove<Equals<
  typeof either,
  {
    Left: typeof either.Left,
    Right: typeof either.Right,
    build: typeof either.build,
    forM: typeof either.forM,
    join: typeof either.join,
    lefts: typeof either.lefts,
    lift: typeof either.lift,
    mapAndUnzipWith: typeof either.mapAndUnzipWith,
    mapM: typeof either.mapM,
    reduceM: typeof either.reduceM,
    rights: typeof either.rights,
    sequence: typeof either.sequence,
    unless: typeof either.unless,
    when: typeof either.when,
    zipWithM: typeof either.zipWithM,
  }
>>(requireMinor("either API"));

(function validateIMaybe<L, A>() {
  const ieither: either.IEither<L, A> = undefined as any;
  prove<Equals<typeof ieither.defaultLeftWith, (value: L) => L>>(requireMajor("either.IEither.defaultLeftWith"));
  prove<Equals<typeof ieither.defaultRightWith, (value: A) => A>>(requireMajor("either.IEither.defaultRightWith"));
  prove<Equals<typeof ieither.flatMap, <B>(f: (a: A) => either.Either<L, B>) => either.Either<L, B>>>(requireMajor("either.IEither.flatMap"));
  prove<Equals<typeof ieither.isLeft, () => boolean>>(requireMajor("either.IEither.isLeft"));
  prove<Equals<typeof ieither.isRight, () => boolean>>(requireMajor("either.IEither.isRight"));
  prove<Equals<typeof ieither.map, <B>(f: (a: A) => B) => either.Either<L, B>>>(requireMajor("either.IEither.map"));
  prove<Equals<typeof ieither.mapLeft, <B>(f: (a: L) => B) => either.Either<B, A>>>(requireMajor("either.IEither.mapLeft"));
  prove<Equals<typeof ieither.matchCase, <B>(cases: either.IEitherCaseScrutinizer<L, A, B>) => B>>(requireMajor("either.IEither.matchCase"));
  prove<Equals<typeof ieither.or, (other: () => either.Either<L, A>) => either.Either<L, A>>>(requireMajor("either.IEither.or"));
  prove<Equals<typeof ieither.replace, <B>(m: either.Either<L, B>) => either.Either<L, B>>>(requireMajor("either.IEither.replace"));
  prove<Equals<typeof ieither.replacePure, <B>(b: B) => either.Either<L, B>>>(requireMajor("either.IEither.replacePure"));
  prove<Equals<typeof ieither.toArray, () => A[]>>(requireMajor("either.IEither.toArray"));
  prove<Equals<typeof ieither.toMaybe, () => maybe.Maybe<A>>>(requireMajor("either.IEither.toMaybe"));
  prove<Equals<typeof ieither.toString, () => string>>(requireMajor("either.IEither.toString"));
  prove<Equals<typeof ieither.voidOut, () => either.Either<L, []>>>(requireMajor("either.IEither.voidOut"));
  prove<Equals<
    typeof ieither,
    {
      defaultLeftWith: typeof ieither.defaultLeftWith,
      defaultRightWith: typeof ieither.defaultRightWith,
      flatMap: typeof ieither.flatMap,
      isLeft: typeof ieither.isLeft,
      isRight: typeof ieither.isRight,
      map: typeof ieither.map,
      mapLeft: typeof ieither.mapLeft,
      matchCase: typeof ieither.matchCase,
      or: typeof ieither.or,
      replace: typeof ieither.replace,
      replacePure: typeof ieither.replacePure,
      toArray: typeof ieither.toArray,
      toMaybe: typeof ieither.toMaybe,
      toString: typeof ieither.toString,
      voidOut: typeof ieither.voidOut,
    }
  >>(requireMinor("either.IEither"));
}());

const ieitherleft: either.IEitherLeft<string> = undefined as any;
prove<Equals<typeof ieitherleft.tag, "Left">>(requireMajor("either.IEitherLeft.tag"));
prove<Equals<typeof ieitherleft.value, string>>(requireMajor("either.IEitherLeft.value"));
prove<Equals<
  typeof ieitherleft,
  {
    tag: typeof ieitherleft.tag;
    value: typeof ieitherleft.value;
  }
>>(requireMinor("either.IEitherLeft"));

const ieitherright: either.IEitherRight<string> = undefined as any;
prove<Equals<typeof ieitherright.tag, "Right">>(requireMajor("either.IEitherRight.tag"));
prove<Equals<typeof ieitherright.value, string>>(requireMajor("either.IEitherRight.value"));
prove<Equals<
  typeof ieitherright,
  {
    tag: typeof ieitherright.tag;
    value: typeof ieitherright.value;
  }
>>(requireMinor("either.IEitherRight"));

/*------------------------------
  MAYBE API
  ------------------------------*/

prove<Equals<typeof maybe.Just, <A>(value: A) => maybe.Maybe<A>>>(requireMajor("maybe.Just"));
prove<Equals<typeof maybe.Nothing, <A>() => maybe.Maybe<A>>>(requireMajor("maybe.Nothing"));
prove<Equals<typeof maybe.arrayToMaybe, <A>(as: A[]) => maybe.Maybe<A>>>(requireMajor("maybe.arrayToMaybe"));
prove<Equals<typeof maybe.build, <T extends object>(spec: maybe.MapMaybe<T>) => maybe.Maybe<T>>>(requireMajor("maybe.build"));
prove<Equals<typeof maybe.catMaybes, <A>(ms: Array<maybe.Maybe<A>>) => A[]>>(requireMajor("maybe.catMaybes"));
prove<Equals<typeof maybe.forM, <A, B>(as: A[], f: (a: A) => maybe.Maybe<B>) => maybe.Maybe<B[]>>>(requireMajor("maybe.forM"));
prove<Equals<typeof maybe.join, <A>(_: maybe.Maybe<maybe.Maybe<A>>) => maybe.Maybe<A>>>(requireMajor("maybe.join"));
prove<Equals<typeof maybe.lift, <P extends any[], R>(f: (...args: P) => R, ...args: maybe.MapMaybe<P>) => maybe.Maybe<R>>>(requireMajor("maybe.lift"));
prove<Equals<typeof maybe.mapAndUnzipWith, <A, B, C>(f: (a: A) => maybe.Maybe<[B, C]>, as: A[]) => maybe.Maybe<[B[], C[]]>>>(requireMajor("maybe.mapAndUnzipWith"));
prove<Equals<typeof maybe.mapM, <A, B>(f: (a: A) => maybe.Maybe<B>, as: A[]) => maybe.Maybe<B[]>>>(requireMajor("maybe.mapM"));
prove<Equals<typeof maybe.mapMaybe, <A, B>(f: (value: A) => maybe.Maybe<B>, ms: A[]) => B[]>>(requireMajor("maybe.mapMaybe"));
prove<Equals<typeof maybe.reduceM, <A, B>(f: (state: B, a: A) => maybe.Maybe<B>, seed: B, as: A[]) => maybe.Maybe<B>>>(requireMajor("maybe.reduceM"));
prove<Equals<typeof maybe.sequence, <A>(mas: Array<maybe.Maybe<A>>) => maybe.Maybe<A[]>>>(requireMajor("maybe.sequence"));
prove<Equals<typeof maybe.toMaybe, <A>(value?: A) => maybe.Maybe<A>>>(requireMajor("maybe.toMaybe"));
prove<Equals<typeof maybe.unless, (b: boolean) => maybe.Maybe<[]>>>(requireMajor("maybe.unless"));
prove<Equals<typeof maybe.when, (b: boolean) => maybe.Maybe<[]>>>(requireMajor("maybe.when"));
prove<Equals<typeof maybe.zipWithM, <A, B, C>(f: (a: A, b: B) => maybe.Maybe<C>, as: A[], bs: B[]) => maybe.Maybe<C[]>>>(requireMajor("maybe.zipWithM"));
prove<Equals<
  typeof maybe,
  {
    Just: typeof maybe.Just,
    Nothing: typeof maybe.Nothing,
    arrayToMaybe: typeof maybe.arrayToMaybe,
    catMaybes: typeof maybe.catMaybes,
    forM: typeof maybe.forM,
    join: typeof maybe.join,
    lift: typeof maybe.lift,
    build: typeof maybe.build,
    mapAndUnzipWith: typeof maybe.mapAndUnzipWith,
    mapM: typeof maybe.mapM,
    mapMaybe: typeof maybe.mapMaybe,
    reduceM: typeof maybe.reduceM,
    sequence: typeof maybe.sequence,
    toMaybe: typeof maybe.toMaybe,
    unless: typeof maybe.unless,
    when: typeof maybe.when,
    zipWithM: typeof maybe.zipWithM,
  }
>>(requireMinor("maybe API"));

(function validateIMaybe<A>() {
  const imaybe: maybe.IMaybe<A> = undefined as any;
  prove<Equals<typeof imaybe.defaultWith, (value: A) => A>>(requireMajor("maybe.IMaybe.defaultWith"));
  prove<Equals<typeof imaybe.filter, (p: (a: A) => boolean) => maybe.Maybe<A>>>(requireMajor("maybe.IMaybe.filter"));
  prove<Equals<typeof imaybe.flatMap, <B>(f: (a: A) => maybe.Maybe<B>) => maybe.Maybe<B>>>(requireMajor("maybe.IMaybe.flatMap"));
  prove<Equals<typeof imaybe.isJust, () => boolean>>(requireMajor("maybe.IMaybe.isJust"));
  prove<Equals<typeof imaybe.isNothing, () => boolean>>(requireMajor("maybe.IMaybe.isNothing"));
  prove<Equals<typeof imaybe.map, <B>(f: (a: A) => B) => maybe.Maybe<B>>>(requireMajor("maybe.IMaybe.map"));
  prove<Equals<typeof imaybe.matchCase, <B>(cases: maybe.IMaybeCaseScrutinizer<A, B>) => B>>(requireMajor("maybe.IMaybe.matchCase"));
  prove<Equals<typeof imaybe.or, (other: () => maybe.Maybe<A>) => maybe.Maybe<A>>>(requireMajor("maybe.IMaybe.or"));
  prove<Equals<typeof imaybe.replace, <B>(m: maybe.Maybe<B>) => maybe.Maybe<B>>>(requireMajor("maybe.IMaybe.replace"));
  prove<Equals<typeof imaybe.replacePure, <B>(b: B) => maybe.Maybe<B>>>(requireMajor("maybe.IMaybe.replacePure"));
  prove<Equals<typeof imaybe.toArray, () => A[]>>(requireMajor("maybe.IMaybe.toArray"));
  prove<Equals<typeof imaybe.toString, () => string>>(requireMajor("maybe.IMaybe.toString"));
  prove<Equals<typeof imaybe.voidOut, () => maybe.Maybe<[]>>>(requireMajor("maybe.IMaybe.voidOut"));
  prove<Equals<
    typeof imaybe,
    {
      defaultWith: typeof imaybe.defaultWith,
      filter: typeof imaybe.filter,
      flatMap: typeof imaybe.flatMap,
      isJust: typeof imaybe.isJust,
      isNothing: typeof imaybe.isNothing,
      map: typeof imaybe.map,
      matchCase: typeof imaybe.matchCase,
      or: typeof imaybe.or,
      replace: typeof imaybe.replace,
      replacePure: typeof imaybe.replacePure,
      toArray: typeof imaybe.toArray,
      toString: typeof imaybe.toString,
      voidOut: typeof imaybe.voidOut,
    }
  >>(requireMinor("maybe.IMaybe"));
}());

const imaybejust: maybe.IMaybeJust<string> = undefined as any;
prove<Equals<typeof imaybejust.tag, "Just">>(requireMajor("maybe.IMaybeJust.tag"));
prove<Equals<typeof imaybejust.value, string>>(requireMajor("maybe.IMaybeJust.value"));
prove<Equals<
  typeof imaybejust,
  {
    tag: typeof imaybejust.tag;
    value: typeof imaybejust.value;
  }
>>(requireMinor("maybe.IMaybeJust"));

const imaybenothing: maybe.IMaybeNothing = undefined as any;
prove<Equals<typeof imaybenothing.tag, "Nothing">>(requireMajor("maybe.IMaybeNothing.tag"));
prove<Equals<
  typeof imaybenothing,
  {
    tag: typeof imaybenothing.tag;
  }
>>(requireMinor("maybe.IMaybeNothing"));

/*------------------------------
  VALIDATION API
  ------------------------------*/

prove<Equals<typeof validation.Invalid, <L extends object | any[], A>(value: L) => validation.Validation<L, A>>>(requireMajor("validation.Invalid"));
prove<Equals<typeof validation.Valid, <L extends object | any[], A>(value: A) => validation.Validation<L, A>>>(requireMajor("validation.Valid"));
prove<Equals<typeof validation.build, <L extends object | any[], T extends object>(spec: validation.MapValidation<L, T>) => validation.Validation<L, T>>>(requireMajor("validation.build"));
prove<Equals<typeof validation.forM, <L extends object | any[], A, B>(as: A[], f: (a: A) => validation.Validation<L, B>) => validation.Validation<L, B[]>>>(requireMajor("validation.forM"));
prove<Equals<typeof validation.failures, <L extends object | any[], A>(ms: Array<validation.Validation<L, A>>) => L[]>>(requireMajor("validation.failures"));
prove<Equals<typeof validation.lift, <L extends object | any[], P extends any[], R>(f: (...args: P) => R, ...args: validation.MapValidation<L, P>) => validation.Validation<L, R>>>(requireMajor("validation.lift"));
prove<Equals<typeof validation.mapAndUnzipWith, <L extends object | any[], A, B, C>(f: (a: A) => validation.Validation<L, [B, C]>, as: A[]) => validation.Validation<L, [B[], C[]]>>>(requireMajor("validation.mapAndUnzipWith"));
prove<Equals<typeof validation.mapM, <L extends object | any[], A, B>(f: (a: A) => validation.Validation<L, B>, as: A[]) => validation.Validation<L, B[]>>>(requireMajor("validation.mapM"));
prove<Equals<typeof validation.successful, <L extends object | any[], A>(ms: Array<validation.Validation<L, A>>) => A[]>>(requireMajor("validation.successful"));
prove<Equals<typeof validation.sequence, <L extends object | any[], A>(mas: Array<validation.Validation<L, A>>) => validation.Validation<L, A[]>>>(requireMajor("validation.sequence"));
prove<Equals<typeof validation.zipWithM, <L extends object | any[], A, B, C>(f: (a: A, b: B) => validation.Validation<L, C>, as: A[], bs: B[]) => validation.Validation<L, C[]>>>(requireMajor("validation.zipWithM"));
prove<Equals<
  typeof validation,
  {
    Invalid: typeof validation.Invalid,
    Valid: typeof validation.Valid,
    build: typeof validation.build,
    failures: typeof validation.failures,
    forM: typeof validation.forM,
    lift: typeof validation.lift,
    mapAndUnzipWith: typeof validation.mapAndUnzipWith,
    mapM: typeof validation.mapM,
    sequence: typeof validation.sequence,
    successful: typeof validation.successful,
    zipWithM: typeof validation.zipWithM,
  }
>>(requireMinor("validation API"));

(function validateIMaybe<L extends object | any[], A>() {
  const ieither: validation.IValidation<L, A> = undefined as any;
  prove<Equals<typeof ieither.defaultWith, (value: A) => A>>(requireMajor("validation.IValidation.defaultWith"));
  prove<Equals<typeof ieither.isInvalid, () => boolean>>(requireMajor("validation.IValidation.isInvalid"));
  prove<Equals<typeof ieither.isValid, () => boolean>>(requireMajor("validation.IValidation.isValid"));
  prove<Equals<typeof ieither.map, <B>(f: (a: A) => B) => validation.Validation<L, B>>>(requireMajor("validation.IValidation.map"));
  prove<Equals<typeof ieither.mapError, <B extends object | any[]>(f: (a: L) => B) => validation.Validation<B, A>>>(requireMajor("validation.IValidation.mapError"));
  prove<Equals<typeof ieither.matchCase, <B>(cases: validation.IValidationCaseScrutinizer<L, A, B>) => B>>(requireMajor("validation.IValidation.matchCase"));
  prove<Equals<typeof ieither.or, (other: () => validation.Validation<L, A>) => validation.Validation<L, A>>>(requireMajor("validation.IValidation.or"));
  prove<Equals<typeof ieither.replace, <B>(m: validation.Validation<L, B>) => validation.Validation<L, B>>>(requireMajor("validation.IValidation.replace"));
  prove<Equals<typeof ieither.replacePure, <B>(b: B) => validation.Validation<L, B>>>(requireMajor("validation.IValidation.replacePure"));
  prove<Equals<typeof ieither.toArray, () => A[]>>(requireMajor("validation.IValidation.toArray"));
  prove<Equals<typeof ieither.toMaybe, () => maybe.Maybe<A>>>(requireMajor("validation.IValidation.toMaybe"));
  prove<Equals<typeof ieither.toString, () => string>>(requireMajor("validation.IValidation.toString"));
  prove<Equals<typeof ieither.voidOut, () => validation.Validation<L, []>>>(requireMajor("validation.IValidation.voidOut"));
  prove<Equals<
    typeof ieither,
    {
      defaultWith: typeof ieither.defaultWith,
      isInvalid: typeof ieither.isInvalid,
      isValid: typeof ieither.isValid,
      map: typeof ieither.map,
      mapError: typeof ieither.mapError,
      matchCase: typeof ieither.matchCase,
      or: typeof ieither.or,
      replace: typeof ieither.replace,
      replacePure: typeof ieither.replacePure,
      toArray: typeof ieither.toArray,
      toEither: typeof ieither.toEither,
      toMaybe: typeof ieither.toMaybe,
      toString: typeof ieither.toString,
      voidOut: typeof ieither.voidOut,
    }
  >>(requireMinor("validation.IEither"));
}());

const ivalidationvalid: validation.IValidationInvalid<string[]> = undefined as any;
prove<Equals<typeof ivalidationvalid.tag, "Invalid">>(requireMajor("validation.IValidationInvalid.tag"));
prove<Equals<typeof ivalidationvalid.failure, string[]>>(requireMajor("validation.IValidationInvalid.failure"));
prove<Equals<
  typeof ivalidationvalid,
  {
    tag: typeof ivalidationvalid.tag;
    failure: typeof ivalidationvalid.failure;
  }
>>(requireMinor("validation.IValidationInvalid"));

const ivalidationinvalid: validation.IValidationValid<string> = undefined as any;
prove<Equals<typeof ivalidationinvalid.tag, "Valid">>(requireMajor("validation.IValidationValid.tag"));
prove<Equals<typeof ivalidationinvalid.value, string>>(requireMajor("validation.IValidationValid.value"));
prove<Equals<
  typeof ivalidationinvalid,
  {
    tag: typeof ivalidationinvalid.tag;
    value: typeof ivalidationinvalid.value;
  }
>>(requireMinor("validation.IValidationValid"));
