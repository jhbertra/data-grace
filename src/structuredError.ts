import { replicate } from "./array";
import { Maybe } from "./maybe";
import { Data, id } from "./prelude";

export type StructuredErrorData<key, error> =
  | Data<"Failure", error>
  | Data<"Multiple", StructuredError<key, error>[]>
  | Data<"Or", StructuredError<key, error>[]>
  | Data<"Path", { key: key; error: StructuredError<key, error> }>;

export class StructuredError<key, error> {
  static Failure<key, error>(error: error): StructuredError<key, error> {
    return new StructuredError({ tag: "Failure", value: error });
  }

  static Multiple<key, error>(errors: StructuredError<key, error>[]): StructuredError<key, error> {
    return new StructuredError({ tag: "Multiple", value: errors });
  }

  static Or<key, error>(errors: StructuredError<key, error>[]): StructuredError<key, error> {
    return new StructuredError({ tag: "Or", value: errors });
  }

  static Path<key, error>(
    key: key,
    error: StructuredError<key, error>,
  ): StructuredError<key, error> {
    return new StructuredError({ tag: "Path", value: { key, error } });
  }

  private constructor(readonly data: StructuredErrorData<key, error>) {}

  query(...path: key[]): Maybe<StructuredError<key, error>> {
    return queryData(this.data, ...path).map(data => new StructuredError(data));
  }

  render(renderKey: (key: key) => string, renderError: (error: error) => string[]): string[] {
    return renderWithIndent(this.data, 0, renderKey, renderError).map(
      ([indent, line]) => String.fromCodePoint(...replicate(indent * 4, 32)) + line,
    );
  }

  /**
   * Pretty-print this [[StructuredError]]
   */
  toString(): string {
    return `${this.data.tag} (${this.data.value})`;
  }

  /**
   * Used to control serialization via `JSON.stringify`.
   */
  toJSON(): any {
    return this.data;
  }
}

function queryData<key, error>(
  error: StructuredErrorData<key, error>,
  ...path: key[]
): Maybe<StructuredErrorData<key, error>> {
  switch (error.tag) {
    case "Failure":
    case "Multiple":
    case "Or":
      return path.isEmpty() ? Maybe.Just(error) : Maybe.Nothing();

    case "Path":
      return Maybe.unCons(path).chain(([key, ks]) =>
        key === error.value.key ? queryData(error.value.error.data, ...ks) : Maybe.Nothing(),
      );
  }
}

function renderWithIndent<key, error>(
  error: StructuredErrorData<key, error>,
  indent: number,
  renderKey: (key: key) => string,
  renderError: (error: error) => string[],
): [number, string][] {
  switch (error.tag) {
    case "Failure":
      return renderError(error.value).map(x => [indent, x]);

    case "Multiple":
      return error.value
        .map(x => renderWithIndent(x.data, indent, renderKey, renderError))
        .intersperse([[0, ""]])
        .chain(id);

    case "Or":
      let i = 1;
      return [
        [indent, "Several alternatives failed:"],
        ...error.value.chain<[number, string]>(x => [
          [indent + 1, `case ${i++}:`],
          ...renderWithIndent(x.data, indent + 2, renderKey, renderError),
        ]),
      ];

    case "Path":
      return [
        [indent, `At ${renderKey(error.value.key)}:`],
        ...renderWithIndent(error.value.error.data, indent + 1, renderKey, renderError),
      ];
  }
}
