import { replicate } from "./array";
import { Maybe } from "./maybe";
import { Data, id } from "./prelude";

export type StructuredError<k, e> =
  | Data<"Failure", e>
  | Data<"Multiple", StructuredError<k, e>[]>
  | Data<"Or", StructuredError<k, e>[]>
  | Data<"Path", { key: k; error: StructuredError<k, e> }>;

export const StructuredError = {
  Failure<k, e>(error: e): StructuredError<k, e> {
    return { tag: "Failure", value: error };
  },
  Multiple<k, e>(errors: StructuredError<k, e>[]): StructuredError<k, e> {
    return { tag: "Multiple", value: errors };
  },
  Or<k, e>(errors: StructuredError<k, e>[]): StructuredError<k, e> {
    return { tag: "Or", value: errors };
  },
  Path<k, e>(key: k, error: StructuredError<k, e>): StructuredError<k, e> {
    return { tag: "Path", value: { key, error } };
  },
  mapKeys<k1, k2, e>(f: (k: k1) => k2, error: StructuredError<k1, e>): StructuredError<k2, e> {
    switch (error.tag) {
      case "Failure":
        return error;

      case "Multiple":
        return StructuredError.Multiple(error.value.map(x => StructuredError.mapKeys(f, x)));

      case "Or":
        return StructuredError.Or(error.value.map(x => StructuredError.mapKeys(f, x)));
      case "Path":
        return StructuredError.Path(
          f(error.value.key),
          StructuredError.mapKeys(f, error.value.error),
        );
    }
  },
  map<k, e1, e2>(f: (e: e1) => e2, error: StructuredError<k, e1>): StructuredError<k, e2> {
    switch (error.tag) {
      case "Failure":
        return StructuredError.Failure(f(error.value));

      case "Multiple":
        return StructuredError.Multiple(error.value.map(x => StructuredError.map(f, x)));

      case "Or":
        return StructuredError.Or(error.value.map(x => StructuredError.map(f, x)));

      case "Path":
        return StructuredError.Path(error.value.key, StructuredError.map(f, error.value.error));
    }
  },
  query<k, e>(error: StructuredError<k, e>, ...path: k[]): Maybe<StructuredError<k, e>> {
    switch (error.tag) {
      case "Failure":
      case "Multiple":
      case "Or":
        return path.isEmpty() ? Maybe.Just(error) : Maybe.Nothing();

      case "Path":
        return Maybe.unCons(path).chain(([k, ks]) =>
          k === error.value.key ? StructuredError.query(error.value.error, ...ks) : Maybe.Nothing(),
        );
    }
  },
  render<k, e>(
    error: StructuredError<k, e>,
    renderKey: (k: k) => string,
    renderError: (e: e) => string[],
  ): string[] {
    return renderWithIndent(error, 0, renderKey, renderError).map(
      ([indent, line]) => String.fromCodePoint(...replicate(indent * 4, 32)) + line,
    );
  },
};

function renderWithIndent<k, e>(
  error: StructuredError<k, e>,
  indent: number,
  renderKey: (k: k) => string,
  renderError: (e: e) => string[],
): [number, string][] {
  switch (error.tag) {
    case "Failure":
      return renderError(error.value).map(x => [indent + 1, x]);

    case "Multiple":
      return error.value
        .map(x => renderWithIndent(x, indent, renderKey, renderError))
        .intersperse([[0, ""]])
        .chain(id);

    case "Or":
      let i = 1;
      return [
        [indent, "Several alternative decode attempts failed:"],
        ...error.value.chain<[number, string]>(x => [
          [indent + 1, `case ${i++}:`],
          ...renderWithIndent(x, indent + 2, renderKey, renderError),
        ]),
      ];

    case "Path":
      return [
        [indent, `At ${renderKey(error.value.key)}:`],
        ...renderWithIndent(error.value.error, indent + 1, renderKey, renderError),
      ];
  }
}
