import { Data, data, id, objectToEntries } from ".";
import { Maybe } from "./maybe";

type Isomorphism<a, b> = {
  to: (a: a) => b;
  from: (b: b) => a;
};

const iso: <a>() => Isomorphism<a, a> = () => ({ to: id, from: id });

export type Schema<a> =
  | Data<"OneOf", readonly [Schema<a>, ...Schema<a>[]]>
  | Data<
      "Array",
      <r>(handler: <b>(schema: Schema<b>, iso: Isomorphism<b[], a>) => r) => r
    >
  | Data<"Bool", Isomorphism<boolean, a>>
  | Data<
      "Combine",
      <r>(
        handler: <x, y>(
          schema1: Schema<x>,
          schema2: Schema<y>,
          iso: Isomorphism<readonly [x, y], a>,
        ) => r,
      ) => r
    >
  | Data<"Date", Isomorphism<Date, a>>
  | Data<"Field", { field: string; schema: Schema<a> }>
  | Data<"Map", <r>(handler: <z>(f: (z: z) => a, schema: Schema<z>) => r) => r>
  | Data<"Null", Isomorphism<null, a>>
  | Data<"Number", Isomorphism<number, a>>
  | Data<"Only", a>
  | Data<
      "Optional",
      <r>(
        handler: <b>(schema: Schema<b>, iso: Isomorphism<Maybe<b>, a>) => r,
      ) => r
    >
  | Data<"Pure", a>
  | Data<"String", Isomorphism<string, a>>
  | Data<"Undefined", Isomorphism<undefined, a>>;

export const Schema = {
  array<b>(schema: Schema<b>): Schema<b[]> {
    return data(
      "Array",
      <r>(handler: (schema: Schema<b>, iso: Isomorphism<b[], b[]>) => r) =>
        handler(schema, iso<b[]>()),
    );
  },
  bool: data("Bool", iso<boolean>()) as Schema<boolean>,
  combine<a, b>(
    schema1: Schema<a>,
    schema2: Schema<b>,
  ): Schema<readonly [a, b]> {
    return data(
      "Combine",
      <r>(
        handler: (
          schema1: Schema<a>,
          schema2: Schema<b>,
          iso: Isomorphism<readonly [a, b], readonly [a, b]>,
        ) => r,
      ) => handler(schema1, schema2, iso<readonly [a, b]>()),
    );
  },
  date: data("Date", iso<Date>()) as Schema<Date>,
  enumOf<a, arr extends readonly [a, ...a[]]>(
    options: arr,
  ): Schema<arr[number]> {
    return data("OneOf", [
      Schema.only(options[0]),
      ...options.slice(1).map(Schema.only),
    ] as const);
  },
  field<a>(field: string, schema: Schema<a>): Schema<a> {
    return data("Field", { field, schema });
  },
  null: data("Null", iso<null>()) as Schema<null>,
  number: data("Number", iso<number>()) as Schema<number>,
  map<a, b>(f: (a: a) => b, schema: Schema<a>): Schema<b> {
    return data("Map", <r>(handler: (f: (a: a) => b, schema: Schema<a>) => r) =>
      handler(f, schema),
    );
  },
  oneOf<a>(alt1: Schema<a>, ...rest: Schema<a>[]): Schema<a> {
    return data("OneOf", [alt1, ...rest] as const);
  },
  only<a>(a: a): Schema<a> {
    return data("Only", a);
  },
  optional<b>(schema: Schema<b>): Schema<Maybe<b>> {
    return data(
      "Optional",
      <r>(
        handler: (schema: Schema<b>, iso: Isomorphism<Maybe<b>, Maybe<b>>) => r,
      ) => handler(schema, iso<Maybe<b>>()),
    );
  },
  pure<a>(a: a): Schema<a> {
    return data("Pure", a);
  },
  record<r extends { [key: string]: any }>(
    spec: { [k in keyof r]: Schema<r[k]> },
  ): Schema<r> {
    return objectToEntries(spec).reduceRight<Schema<r>>(
      (r, [key, field]) =>
        Schema.map(
          ([r_, field_]) => ({ ...r_, [key]: field_ }),
          Schema.combine<r, r[keyof r]>(r, field),
        ),
      Schema.pure({} as r),
    );
  },
  tuple<t extends any[]>(
    ...schemas: { [k in keyof t]: Schema<t[k]> }
  ): Schema<t> {
    return schemas.reduceRight<Schema<t>>(
      (t, schema) =>
        Schema.map(
          ([t_, schema_]) => [...t_, schema_] as t,
          Schema.combine(t, schema),
        ),
      Schema.pure(([] as unknown) as t),
    );
  },
  string: data("String", iso<string>()) as Schema<string>,
  undefined: data("Undefined", iso<undefined>()) as Schema<undefined>,
};
