import { Maybe } from "./maybe";
import { Data, objectToEntries } from "./prelude";

/**
 * A container structure that can be inhabited by one
 * of two types - `value`, or `error`. This is used to
 * encode the result of a calculation which may fail
 * for some inputs. If the calculation is succesful, the
 * result is wrapped in a [[Result]] created via the
 * [[Result.Ok]] factory method. If the calculation resulted
 * in an error, the error information is wrapped in a [[Result]]
 * created via the [[Result.Error]] factory method.
 */
export class Result<value, error> {
  /**
   * Creates a [[Result]] which contains the value produced
   * by a succesful operation.
   *
   * @param value the value produced by the successful operation.
   */
  public static Ok<value, error>(value: value): Result<value, error> {
    return new Result({ tag: "Ok", value });
  }

  /**
   * Creates a [[Result]] which contains the error produced
   * by a failed operation.
   *
   * @param error the error produced by the failed operation.
   */
  public static Error<value, error>(error: error): Result<value, error> {
    return new Result({ tag: "Error", value: error });
  }

  /**
   * Creates a new [[Result]] that either contains
   * the first element of arr if it exists, or
   * `error`.
   *
   * ```ts
   * Result.fromArray([], "error"); // Ok (error)
   * Result.fromArray([1], "error"); // Error (1)
   * Result.fromArray([1, 2, 3], "error"); // Error (1)
   * ```
   *
   * @param arr An array to convert to a [[Result]]
   * @param error An error to return if `arr` is empty
   * @returns A [[Result]] containing the first element of `arr`, or `error` if it is empty.
   */
  static fromArray<value, error>(arr: value[], error: error): Result<value, error> {
    return arr.length === 0 ? Result.Error(error) : Result.Ok(arr[0]);
  }

  /**
   * Creates a new [[Result]] that either contains
   * the value inside `maybe` if it exists, or
   * `error`.
   *
   * ```ts
   * Result.fromMaybe(Maybe.Nothing(), "error"); // Ok (error)
   * Result.fromMaybe(Maybe.Just(1), "error"); // Error (1)
   * ```
   *
   * @param maybe A [[Maybe]] to convert to a [[Result]]
   * @param error An error to return if `maybe` is empty
   * @returns A [[Result]] containing the value inside `maybe`, or `error` if it is empty.
   */
  static fromMaybe<value, error>(maybe: Maybe<value>, error: error): Result<value, error> {
    return maybe.matchCase({
      just: (b: value) => Result.Ok(b),
      nothing: () => Result.Error(error),
    });
  }

  /**
   * Returns all the errors from a list of results.
   *
   * ```ts
   * Result.errors(Result.Ok("bob"), Result.Error("error"), Result.Ok("sue")); // ["error"]
   * ```
   *
   * @param results An array of [[Result]] values.
   * @returns an array containing all [[Error]] values found in `results`.
   */
  static errors<value, error>(results: Array<Result<value, error>>): error[] {
    const errors: error[] = [];
    for (const result of results) {
      if (result.data.tag === "Error") {
        errors.push(result.data.value);
      }
    }
    return errors;
  }

  /**
   * Returns all the successes from a list of results.
   *
   * ```ts
   * Result.oks(Result.Ok("bob"), Result.Error("error"), Result.Ok("sue")); // ["bob", "sue"]
   * ```
   *
   * @param results An array of [[Result]] values.
   * @returns an array containing all [[Ok]] values found in `results`.
   */
  static oks<value, error>(es: Array<Result<value, error>>): value[] {
    const result: value[] = [];
    for (const e of es) {
      if (e.data.tag === "Ok") {
        result.push(e.data.value);
      }
    }
    return result;
  }

  /**
   * Composes a [[Result]] by constructing an object out of
   * multiple [[Result]]s. If all the components are [[Ok]],
   * The object will be constructed, otherwise the first error will
   * be returned.
   *
   * ```ts
   * type Foo = { bar: string, baz: Maybe<boolean> };
   *
   * // Error (invalid bar)
   * Result.record<string, Foo>({
   *     bar: Result.Error("invalid bar"),
   *     baz: Result.Error("invalid baz")
   * });
   *
   * // Error (invalid baz)
   * Result.record<string, Foo>({
   *     bar: Result.Ok("BAR"),
   *     baz: Result.Error("invalid baz")
   * });
   *
   * // Ok ({ bar: "BAR", baz: "baz" })
   * Result.record<string, Foo>({
   *     bar: Result.Ok("BAR"),
   *     baz: Result.Ok(Just("baz"))
   * });
   * ```
   *
   * @param spec an object composed of [[Result]]s to build the result out of in a [[Result]].
   * @returns a [[Result]] which will produce a `recod` with the [[Ok]] values of the [[Result]]s in `spec`.
   */
  static record<error, record>(
    spec: { [key in keyof record]: Result<record[key], error> },
  ): Result<record, error> {
    return objectToEntries(spec).reduce(
      (recResult, [k, result]) =>
        recResult.combine(result).map(([record, v]) => ({ ...record, [k]: v })),
      Result.Ok<record, error>({} as record),
    );
  }

  /**
   * Aggregate a sequence of [[Result]]s and combine their results.
   *
   * ```ts
   * Result.sequence([]); // Ok ([])
   * Result.sequence([Result.Error("error")]); // Error (error)
   * Result.sequence([Result.Ok(1)]); // Ok([1])
   * Result.sequence([Result.Ok(1), Result.Error("error"), Result.Ok(3)]); // Error (error)
   * Result.sequence([Result.Ok(1), Result.Ok(2), Result.Ok(3)]); // Ok ([1, 2, 3])
   * ```
   *
   * @param results an array of [[Result]]s to sequence
   * @returns a [[Result]] of size `results.length` if all elements have a value, else the first [[Error]].
   */
  static sequence<value, error>(results: Array<Result<value, error>>): Result<value[], error> {
    return results.reduce(
      (arr, result) => arr.combine(result).map(([vs, v]) => [...vs, v]),
      Result.Ok([] as value[]),
    );
  }

  private constructor(private readonly data: Data<"Ok", value> | Data<"Error", error>) {}

  /**
   * If this [[Result]] is [[Ok]], use its value to compute the next [[Result]].
   * Used to compose sequential calculations where each step may fail.
   *
   * ```ts
   * const result = Result
   *   .Ok("Bob")
   *   .chain(name => name === "Jim" ? Result.Ok({ agentId: 12 }) : Result.Error("Not Authorized"))
   *   .chain(({agentId}) => agentId > 15 ? Result.Ok("Access granted") : Result.Error("Access denied"));
   *
   * result.toString() // "Error (Not Authorized)"
   * ```
   *
   * @param f a function used to produce the next [[Result]] when this [[Result]] is [[Ok]].
   * @returns The result of running `f` if this [[Result]] is [[Ok]].
   */
  chain<nextValue>(f: (a: value) => Result<nextValue, error>): Result<nextValue, error> {
    return this.data.tag === "Error" ? (this as any) : f(this.data.value);
  }

  /**
   * If this [[Result]] is [[Ok]], and `other` is also [[Ok]], wrap their values in a combined [[Result]].
   * Used to compose parallel calculations where each component may fail.
   *
   * ```ts
   * Result.Error("error1").combine(Result.Error("error2")); // Error ("error1")
   * Result.Ok("Bob").combine(Result.Error("error2")); // Error ("error2")
   * Result.Ok("Bob").combine(Result.Ok("Jim")); // Ok (["Bob", "Jim"])
   * ```
   *
   * @param other the result of another computation to combine with this one.
   * @returns The combined results of both computations or the first [[Error]].
   */
  combine<otherValue>(
    other: Result<otherValue, error>,
  ): Result<readonly [value, otherValue], error> {
    return this.data.tag === "Error"
      ? (this as any)
      : other.data.tag === "Error"
      ? (other as any)
      : Result.Ok([this.data.value, other.data.value]);
  }

  /**
   * Extract the value of this [[Result]] if it is [[Ok]], or default to `value`.
   *
   * ```ts
   * Result.Error<boolean, string>("foo").defaultWith(true); // true
   * Result.Ok<boolean, string>(false).defaultWith(true); // false
   * ```
   *
   * @param value The value to return in case this result is an [[Error]]
   * @returns The [[Ok]] value within this [[Result]] or `value`.
   */
  defaultWith(value: value): value {
    return this.data.tag === "Error" ? value : this.data.value;
  }

  /**
   * Extract the error of this [[Result]] if it is [[Error]], or default to `error`.
   *
   * ```ts
   * Result.Error<boolean, string>("foo").defaultErrorWith("bar"); // "foo"
   * Result.Ok<boolean, string>(false).defaultErrorWith("bar"); // "bar"
   * ```
   *
   * @param value The value to return in case this result is an [[Ok]]
   * @returns The [[Error]] value within this [[Result]] or `error`.
   */
  defaultErrorWith(error: error): error {
    return this.data.tag === "Error" ? this.data.value : error;
  }

  /**
   * Returns true if this is an [[Ok]], false otherwise.
   *
   * @returns true if this is an [[Ok]], false otherwise.
   */
  get isOk(): boolean {
    return this.data.tag === "Ok";
  }

  /**
   * Returns true if this is an [[Error]], false otherwise.
   *
   * @returns true if this is an [[Error]], false otherwise.
   */
  get isError(): boolean {
    return this.data.tag === "Error";
  }

  /**
   * Convert the error of this [[Result]] to a [[Maybe]].
   *
   * ```ts
   * Result.Ok("bob").maybeError; // Nothing
   * Result.Error(false).maybeError; // Just(false)
   * ```
   *
   * @returns A [[Maybe]] containing the [[Error]] value contained by this [[Result]], else [[Nothing]].
   */
  get maybeError(): Maybe<error> {
    return Maybe.dataToMaybe("Error", this.data);
  }

  /**
   * Convert the value of this [[Result]] to a [[Maybe]].
   *
   * ```ts
   * Result.Ok("bob").maybeValue; // Just ("bob")
   * Result.Error(false).maybeValue; // Nothing
   * ```
   *
   * @returns A [[Maybe]] containing the [[Ok]] value contained by this [[Result]], else [[Nothing]].
   */
  get maybeValue(): Maybe<value> {
    return Maybe.dataToMaybe("Value", this.data);
  }

  /**
   * Transform the value in this [[Result]].
   *
   * ```ts
   * Result.Ok("bob").map(name => name.toUpperCase()).toString(); // "Ok (BOB)"
   * Result.Error("error").map(name => name.toUpperCase()).toString(); // "Error (error)"
   * ```
   *
   * @param f a function that modifies the [[Ok]] value within this [[Result]].
   * @returns a [[Result]] with its [[Ok]] value transformed.
   */
  map<mappedValue>(f: (b: value) => mappedValue): Result<mappedValue, error> {
    return this.data.tag === "Error" ? (this as any) : Result.Ok(f(this.data.value));
  }

  /**
   * Transform the error in this [[Result]].
   *
   * ```ts
   * Result.Ok("bob").mapError(name => name.toUpperCase()).toString(); // "Ok (bob)"
   * Result.Error("error").mapError(name => name.toUpperCase()).toString(); // "Error (ERROR)"
   * ```
   *
   * @param f a function that modifies the [[Error]] value within this [[Result]].
   * @returns a [[Result]] with its [[Error]] value transformed.
   */
  mapError<mappedError>(f: (b: error) => mappedError): Result<value, mappedError> {
    return this.data.tag === "Error" ? Result.Error(f(this.data.value)) : (this as any);
  }

  /**
   * Run a callback based on the case of the [[Result]]
   *
   * ```ts
   * Result.Error<boolean, string>("bob").matchCase({
   *   Error: x => x.toUpperCase(),
   *   Ok: x => x ? "Yes" : "No",
   * ); // "BOB"
   *
   * Result.Ok<boolean, string>(false).matchCase({
   *   Error: x => x.toUpperCase(),
   *   Ok: x => x ? "Yes" : "No",
   * ); // "No"
   * ```
   *
   * @param cases an object containing callbacks that scrutinize the structure of this [[Result]]
   * @returns the result of calling the appropriate callback in `cases`.
   */
  matchCase<result>(cases: ResultCaseScrutinizer<value, error, result>): result {
    return cases[this.data.tag](this.data.value as any);
  }

  /**
   * Pick this [[Result]] if it is [[Ok]] otherwise pick the other.
   *
   * ```ts
   * Result.Ok("bob").or(Result.Ok("sue")).toString(); // "Ok (bob)"
   * Result.Error(false).or(Result.Ok("sue")).toString(); // "Ok (sue)"
   * Result.Error(false).or(Result.Error(true)).toString(); // "Error (true)"
   * ```
   *
   * @param other a [[Result]] to chose if this one is [[Error]].
   * @returns if `this` is [[Ok]], `this`, else `other`.
   */
  or(other: Result<value, error> | (() => Result<value, error>)): Result<value, error> {
    return this.data.tag === "Error" ? (typeof other === "function" ? other() : other) : this;
  }

  /**
   * If this [[Result]] is [[Ok]] replace it with a different [[Result]].
   *
   * ```ts
   * Result.Ok("bob").replace(Result.Ok("sue")).toString(); // "Ok (sue)"
   * Result.Ok("bob").replace(Result.Error(true)).toString(); // "Error (true)"
   * Result.Error(false).replace(Result.Ok("sue")).toString(); // "Error (false)"
   * Result.Error(false).replace(Result.Error(true)).toString(); // "Error (false)"
   * ```
   *
   * @param nextResult The [[Result]] to replace this one with if it has a value.
   * @returns `m` if `this` is [[Ok]], else `this`.
   */
  replace<nextValue>(
    nextResult: Result<nextValue, error> | (() => Result<nextValue, error>),
  ): Result<nextValue, error> {
    return this.chain(typeof nextResult === "function" ? nextResult : () => nextResult);
  }

  /**
   * If this [[Result]] is [[Ok]] replace it with a pure value.
   *
   * ```ts
   * Result.Ok("bob").replace(42).toString(); // "Ok (42)"
   * Result.Error(false).replace(42).toString(); // "Error (false)"
   * ```
   *
   * @param b the value to replace the contents of this [[Result]] with.
   * @returns A [[Result]] containing `b` if `this` is [[Ok]], else `this`.
   */
  replacePure<nextValue>(nextValue: nextValue): Result<nextValue, error> {
    return this.replace(Result.Ok(nextValue));
  }

  /**
   * Swaps the cases of this [[Result]].
   */
  swap(): Result<error, value> {
    return this.data.tag === "Error" ? Result.Ok(this.data.value) : Result.Error(this.data.value);
  }

  /**
   * Convert this [[Result]] to an array with either one or
   * zero elements.
   *
   * ```ts
   * Result.Error("bob").toArray(); // ["bob"]
   * Result.Ok(false).toArray(); // []
   * ```
   *
   * @returns A one-element array containing the [[Ok]] value contained by this [[Result]], else an empty array.
   */
  toArray(): [] | [value] {
    return this.data.tag === "Error" ? [] : [this.data.value];
  }

  /**
   * Pretty-print this [[Result]]
   *
   * @returns a string formatted `"Ok (...)"` or `"Error (...)"`.
   */
  toString(): string {
    return this.data.tag === "Error" ? `Error (${this.data.value})` : `Ok (${this.data.value})`;
  }

  /**
   * Used to control serialization via `JSON.stringify`.
   */
  toJSON(): any {
    return this.data;
  }

  /**
   * Discard the value in the [[Result]].
   *
   * ```ts
   * Result.Ok("bob").voidOut().toString(); // "Ok (undefined)"
   * Result.Error(false).voidOut().toString(); // "Error (false)"
   * ```
   *
   * @returns A [[Result]] with undefined in it, or `this` if `this` is [[Error]].
   */
  voidOut(): Result<void, error> {
    return this.replacePure(undefined);
  }
}

/**
 * Defines the set of functions required to scrutinize the cases of a [[Result]].
 */
interface ResultCaseScrutinizer<value, error, result> {
  /**
   * Callback which is called in the case of an [[Ok]].
   */
  Ok(value: value): result;

  /**
   * Callback which is called in the case of an [[Error]].
   */
  Error(error: error): result;
}
