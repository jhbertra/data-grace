import { Data, objectToEntries } from "./prelude";

/*------------------------------
  DATA TYPES
  ------------------------------*/

/**
 * The public methods exposed by the [[Maybe]] type.
 */
export class Maybe<value> {
  private static staticNothing: Maybe<any> = new Maybe({ tag: "Nothing", value: undefined });

  /**
   * Creates a [[Maybe]] which contains a value.
   *
   * @param value the value.
   */
  public static Just<value>(value: value): Maybe<value> {
    return new Maybe({ tag: "Just", value });
  }

  /**
   * Creates a [[Maybe]] which contains no value.
   *
   * @param error the error produced by the failed operation.
   */
  public static Nothing<value>(): Maybe<value> {
    return Maybe.staticNothing;
  }

  /**
   * Creates a new [[Maybe]] that either contains
   * the first element of arr if it exists, or
   * nothing.
   *
   * ```ts
   * arrayToMaybe([]); // Nothing
   * arrayToMaybe([1]); // Maybe.Just (1)
   * arrayToMaybe([1, 2, 3]); // Maybe.Just(1)
   * ```
   *
   * @param arr An array to convert to a [[Maybe]]
   * @returns A [[Maybe]] containing the first element of `arr`, or [[Nothing]] if it is empty.
   */
  public static fromArray<A>(arr: A[]): Maybe<A> {
    return arr.length === 0 ? Maybe.staticNothing : Maybe.Just(arr[0]);
  }

  /**
   * Creates a new [[Maybe]] that either contains
   * the first element of arr if it exists and the tail, or
   * nothing.
   *
   * ```ts
   * arrayToMaybe([]); // Nothing
   * arrayToMaybe([1]); // Maybe.Just ([1, []])
   * arrayToMaybe([1, 2, 3]); // Maybe.Just([1, [2. 3]])
   * ```
   *
   * @param arr An array to convert to a [[Maybe]]
   * @returns A [[Maybe]] containing the first element of `arr` and the tail, or [[Nothing]] if it is empty.
   */
  public static unCons<A>(arr: A[]): Maybe<[A, A[]]> {
    return arr.length === 0 ? Maybe.staticNothing : Maybe.Just([arr[0], arr.slice(1)]);
  }

  /**
   * Returns a list of all values found in the input list.
   *
   * ```ts
   * catMaybes([Just("foo"), Maybe.Nothing(), Maybe.Just("bar")]); // ["foo", "bar"]
   * ```
   *
   * @param ms An array of [[Maybe]] values.
   * @returns an array containing all data found in `ms`.
   */
  public static catMaybes<A>(ms: Array<Maybe<A>>): A[] {
    const results: A[] = [];
    for (const m of ms) {
      if (m.data.tag === "Just") {
        results.push(m.data.value);
      }
    }
    return results;
  }

  public static fromData<
    Case extends Tag,
    Tag extends string,
    TData extends Data<Tag, any>,
    T extends TData extends Data<Case, infer TT> ? TT : never
  >(data: TData, match: Case): Maybe<T> {
    return data.tag === match ? Maybe.Just(data.value) : Maybe.Nothing();
  }

  /**
   * Analog of
   * [Array.prototype.map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map)
   * which allows the mapping to discard values.
   *
   * ```ts
   * mapMaybes(f, arr) === catMaybes(arr.map(f));
   * ```
   *
   * @param f a mapping which can discard values if desired.
   * @returns the contents of `as` transformed by `f` when a value was returned.
   */
  public static mapMaybe<A, value2>(f: (value: A) => Maybe<value2>, as: A[]): value2[] {
    const results: value2[] = [];
    for (const a of as) {
      const m = f(a);
      if (m.data.tag === "Just") {
        results.push(m.data.value);
      }
    }
    return results;
  }

  /**
   * Creates a new [[Maybe]] from an optional value, either returning a [[Just]] or a
   * [[Nothing]] depending if the value is defined or not.
   *
   * ```ts
   * toMaybe(null); // Nothing
   * toMaybe(undefined); // Nothing
   * toMaybe(12); // Maybe.Just(12)
   * ```
   *
   * @param value the value to wrap in a [[Maybe]].
   * @returns `Just(value)` if value is non-null and defined, else `Nothing`.
   */
  public static fromJS<A>(value: A | null | undefined): Maybe<A> {
    return value == null ? Maybe.staticNothing : Maybe.Just(value);
  }

  /**
   * Composes a [[Maybe]] by constructing an object out of
   * multiple [[Maybe]]s. If all the components have a value,
   * the result will also have a value, otherwise nothing will be
   * returned.
   *
   * ```ts
   * type Foo = { bar: string, baz: Maybe<boolean> };
   *
   * // Nothing
   * record<Foo>({
   *     bar: Maybe.Nothing(),
   *     baz: Maybe.Nothing()
   * });
   *
   * // Nothing
   * record<Foo>({
   *     bar: Maybe.Just("BAR"),
   *     baz: Maybe.Nothing()
   * });
   *
   * // Maybe.Just ({ bar: "BAR", baz: { tag: "Just", value: "baz" } })
   * record<Foo>({
   *     bar: Maybe.Just("BAR"),
   *     baz: Maybe.Just(Just("baz"))
   * });
   * ```
   *
   * @param spec an object composed of [[Maybe]]s to build the result out of in a [[Maybe]].
   * @returns a [[Maybe]] which will produce a `T` with the outputs of the [[Maybe]]s in `spec`.
   */
  public static record<record extends object>(
    spec: { [key in keyof record]: Maybe<record[key]> },
  ): Maybe<record> {
    return objectToEntries(spec).reduce(
      (recResult, [k, result]) =>
        recResult.combine(result).map(([record, v]) => ({ ...record, [k]: v })),
      Maybe.Just({} as record),
    );
  }

  /**
   * Aggregate a sequence of [[Maybe]]s and combine their results.
   *
   * ```ts
   * sequence([]); // Maybe.Just([])
   * sequence([Maybe.Nothing()]); // Nothing
   * sequence([Just(1)]); // Maybe.Just([1])
   * sequence([Just(1), Maybe.Nothing(), Maybe.Just(3)]); // Nothing
   * sequence([Just(1), Maybe.Just(2), Maybe.Just(3)]); // Maybe.Just([1, 2, 3])
   * ```
   *
   * @param mas an array of [[Maybe]]s to sequence
   * @returns a [[Maybe]] of size `mas.length` if all elements have a value, else [[Nothing]].
   */
  public static sequence<value>(maybes: Array<Maybe<value>>): Maybe<value[]> {
    return maybes.reduce(
      (arr, result) => arr.combine(result).map(([vs, v]) => [...vs, v]),
      Maybe.Just([] as value[]),
    );
  }

  private constructor(private readonly data: Data<"Just", value> | Data<"Nothing">) {}

  /**
   * Extract the value of this [[Maybe]] if it has one, or default to a.
   *
   * ```ts
   * Maybe.Just("foo").defaultWith("bar"); // "foo"
   * Maybe.Nothing().defaultWith("bar"); // "bar"
   * ```
   *
   * @param a The value to return in case this is [[Nothing]]
   * @returns The value within this [[Maybe]] or `a`.
   */
  defaultWith(value: value): value {
    return this.data.tag === "Just" ? this.data.value : value;
  }

  /**
   * Remove unwanted values from this [[Maybe]] with a predicate.
   *
   * ```ts
   * Maybe.Just("foo").filter(x => x === "foo"); // Maybe.Just (foo)
   * Maybe.Just("bar").filter(x => x === "foo"); // Nothing
   * Maybe.Nothing().filter(x => x === "foo"); // Nothing
   * ```
   *
   * @param p a predicate to test the value against
   * @returns a [[Maybe]] where any value which doesn't satisfy `p` is removed.
   */
  filter(p: (value: value) => boolean): Maybe<value> {
    return this.data.tag === "Just" && p(this.data.value) ? this : Maybe.Nothing();
  }

  /**
   * Chain a calculation that may also resolve to a nothing value
   * on the value contained by this [[Maybe]].
   *
   * ```ts
   * Maybe.Just("foo").chain(x => Maybe.Just(`${x}bar`)); // Maybe.Just (foobar)
   * Maybe.Just("foo").chain(x => Maybe.Nothing()); // Nothing
   * Maybe.Nothing().chain(x => Maybe.Just(`${x}bar`)); // Nothing
   * Maybe.Nothing().chain(x => Maybe.Nothing()); // Nothing
   * ```
   *
   * @param f a to produce the next [[Maybe]] when this [[Maybe]] has a value.
   * @returns The result of running `f` if this [[Maybe]] has a value/.
   */
  chain<value2>(f: (value: value) => Maybe<value2>): Maybe<value2> {
    return this.data.tag === "Just" ? f(this.data.value) : Maybe.staticNothing;
  }

  /**
   * Combine a calculation that may also resolve to a nothing value
   * with the value contained by this [[Maybe]].
   *
   * ```ts
   * Maybe.Nothing().combine(Maybe.Nothing()); // Nothing
   * Maybe.Just("Bob").combine(Maybe.Nothing()); // Nothing
   * Maybe.Just("Bob").combine(Maybe.Just("Jim")); // Just (["Bob", "Jim"])
   * ```
   *
   * @param m a second [[Maybe]] whose value to combine with this one.
   * @returns The result of combining the value of `m` with the value of `this`.
   */
  combine<value2>(m: Maybe<value2>): Maybe<readonly [value, value2]> {
    return this.data.tag === "Just" && m.data.tag === "Just"
      ? Maybe.Just([this.data.value, m.data.value])
      : Maybe.staticNothing;
  }

  /**
   * A type guard which determines if this [[Maybe]] is a [[Just]].
   *
   * ```ts
   * const result = Maybe.Just("foo");
   * if (result.isJust) {
   *     result.value; // "foo";
   * }
   * ```
   *
   * @returns true if this is a [[Just]], false otherwise.
   */
  get isJust(): boolean {
    return this.data.tag === "Just";
  }

  /**
   * A type guard which determines if this [[Maybe]] is a [[Nothing]].
   *
   * ```ts
   * const result = Maybe.Nothing();
   * if (result.isMaybe.Nothing()) {
   *     result.value; // undefined / compiler error.
   * }
   * ```
   *
   * @returns true if this is a [[Nothing]], false otherwise.
   */
  get isNothing(): boolean {
    return this.data.tag === "Nothing";
  }

  /**
   * Transform the value contained by this [[Maybe]].
   *
   * ```ts
   * Maybe.Just("foo").map(x => `${x}bar`); // Maybe.Just (foobar)
   * Maybe.Nothing().map(x => `${x}bar`); // Nothing
   * ```
   *
   * @param f a function that modifies the value within the [[Maybe]].
   * @returns a [[Maybe]] with its contents transformed.
   */
  map<value2>(f: (value: value) => value2): Maybe<value2> {
    return this.data.tag === "Just" ? Maybe.Just(f(this.data.value)) : Maybe.staticNothing;
  }

  /**
   * Pass the value contained by this [[Maybe]] to an imperitive callback.
   *
   * ```ts
   * Maybe.Just("foo").do(x => { console.log(x); }); // Maybe.Just(foo)
   * Maybe.Nothing().do(x => { console.log(x); }); // Nothing
   * ```
   *
   * @param f an action that is run with the value within the [[Maybe]].
   * @returns this Maybe.
   */
  do(f: (value: value) => void): Maybe<value> {
    if (this.data.tag === "Just") {
      f(this.data.value);
    }
    return this;
  }

  /**
   * Run a callback based on the case of the [[Maybe]].
   *
   * ```ts
   * Maybe.Just("foo").matchCase({
   *     just: x => x.toUpperCase(),
   *     nothing: () => "got nothing"); // "FOO"
   *
   * Maybe.Nothing().matchCase({
   *     just: x => x.toUpperCase(),
   *     nothing: () => "got nothing"); // "got nothing"
   * ```
   *
   * @param cases an object containing callbacks that scrutinize the structure of this [[Maybe]]
   * @returns the result of calling the appropriate callback in `cases`.
   */
  matchCase<value2>(cases: MaybeCaseScrutinizer<value, value2>): value2 {
    return cases[this.data.tag](this.data.value as any);
  }

  /**
   * Pick this @Maybe if it has a value otherwise pick the other.
   *
   * ```ts
   * Maybe.Just("bob").or(Just("sue")).toString(); // "Just (bob)"
   * Maybe.Nothing().or(Just("sue")).toString(); // "Just (sue)"
   * Maybe.Nothing().or(Maybe.Nothing()).toString(); // "Nothing"
   * ```
   *
   * @param other a [[Maybe]] to chose if this one is [[Nothing]].
   * @returns the first of `this, other` which has a value, else [[Nothing]].
   */
  or(other: Maybe<value>): Maybe<value> {
    return this.data.tag === "Just" ? this : other;
  }

  /**
   * Replace the value in this [[Maybe]] with another [[Maybe]].
   *
   * ```ts
   * Maybe.Just("bob").replace(Just("sue")).toString(); // "Just (sue)"
   * Maybe.Just("bob").replace(Maybe.Nothing()).toString(); // "Nothing"
   * Maybe.Nothing().replace(Just("sue")).toString(); // "Nothing"
   * Maybe.Nothing().replace(Maybe.Nothing()).toString(); // "Nothing"
   * ```
   *
   * @param m The [[Maybe]] to replace this one with if it has a value.
   * @returns `m` if this has a value, else [[Nothing]].
   */
  replace<value2>(m: Maybe<value2>): Maybe<value2> {
    return this.data.tag === "Just" ? m : Maybe.staticNothing;
  }

  /**
   * Replace the value in this [[Maybe]] with a new value.
   *
   * ```ts
   * Maybe.Just("bob").replace(42).toString(); // "Just (42)"
   * Maybe.Nothing().replace(42).toString(); // "Nothing"
   * ```
   *
   * @param b the value to replace the contents of this [[Maybe]] with.
   * @returns A [[Maybe]] containing `b` if this has a value, else [[Nothing]].
   */
  replacePure<value2>(b: value2): Maybe<value2> {
    return this.data.tag === "Just" ? Maybe.Just(b) : Maybe.staticNothing;
  }

  /**
   * Convert this [[Maybe]] to an array with either one or
   * zero elements.
   *
   * ```ts
   * Maybe.Just("bob").toArray(); // [42]
   * Maybe.Nothing().toArray(); // []
   * ```
   *
   * @returns A one-element array containing the value contained by this [[Maybe]], else an empty array.
   */
  toArray(): [] | [value] {
    return this.data.tag === "Just" ? [this.data.value] : [];
  }

  /**
   * Pretty-print this [[Maybe]]
   *
   * @returns a string formatted `"Just (...)"` or `"Nothing"`.
   */
  toString(): string {
    return this.data.tag === "Just" ? `Just (${this.data.value})` : "Nothing";
  }

  /**
   * Used to control serialization via `JSON.stringify`.
   */
  toJSON(): any {
    return this.data.tag === "Just" ? this.data.value : null;
  }

  /**
   * Compare the values in both Maybes, assuming they both have values.
   */
  valueEquals(other: Maybe<value>, p?: (a: value, b: value) => boolean): boolean {
    const eqFn = p ?? ((a, b) => a === b);
    return (
      this.data.tag === "Just" &&
      other.data.tag === "Just" &&
      eqFn(this.data.value, other.data.value)
    );
  }

  /**
   * Compare the value in this Maybe with a pure value, assuming it has a  value.
   */
  valueEqualsPure(other: value, p?: (a: value, b: value) => boolean): boolean {
    const eqFn = p ?? ((a, b) => a === b);
    return this.data.tag === "Just" && eqFn(this.data.value, other);
  }

  /**
   * Discard any value contained by this [[Maybe]]
   *
   * @returns A [[Maybe]] with an empty array in it, or [[Nothing]] if this is [[Nothing]].
   */
  voidOut(): Maybe<void> {
    return this.replacePure(undefined);
  }
}

/**
 * Defines the set of functions required to scrutinize the cases of a [[Maybe]].
 */
interface MaybeCaseScrutinizer<A, value2> {
  /**
   * Callback which is called in the case a [[Maybe]] has a value.
   */
  Just(a: A): value2;

  /**
   * Callback which is called in the case a [[Maybe]] has no value.
   */
  Nothing(): value2;
}
