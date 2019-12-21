import { Data, data, id, objectToEntries } from ".";
import { Maybe } from "./maybe";

type Isomorphism<a, b> = {
  to: (a: a) => b;
  from: (b: b) => a;
};

const iso: <a>() => Isomorphism<a, a> = () => ({ to: id, from: id });

export interface ISchema<a, metadata> {
  readonly metadata?: metadata;
  combine<b>(schema2: Schema<b, metadata>): Schema<readonly [a, b], metadata>;
  map<b>(f: (a: a) => b): Schema<b, metadata>;
  or(schema2: Schema<a, metadata>): Schema<a, metadata>;
  setMetadata(metadata: metadata): Schema<a, metadata>;
}

type SchemaData<a, metadata> =
  | Data<
      "Array",
      <r>(handler: <b>(schema: Schema<b, metadata>, iso: Isomorphism<b[], a>) => r) => r
    >
  | Data<"Bool", Isomorphism<boolean, a>>
  | Data<
      "Combine",
      <r>(
        handler: <x, y>(
          schema1: Schema<x, metadata>,
          schema2: Schema<y, metadata>,
          iso: Isomorphism<readonly [x, y], a>,
        ) => r,
      ) => r
    >
  | Data<"Date", Isomorphism<Date, a>>
  | Data<"Field", { field: string; schema: Schema<a, metadata> }>
  | Data<"Map", <r>(handler: <z>(f: (z: z) => a, schema: Schema<z, metadata>) => r) => r>
  | Data<"Null", Isomorphism<null, a>>
  | Data<"Number", Isomorphism<number, a>>
  | Data<"Only", a>
  | Data<
      "Optional",
      <r>(handler: <b>(schema: Schema<b, metadata>, iso: Isomorphism<Maybe<b>, a>) => r) => r
    >
  | Data<"Or", readonly [Schema<a, metadata>, Schema<a, metadata>]>
  | Data<"Pure", a>
  | Data<"String", Isomorphism<string, a>>
  | Data<"Undefined", Isomorphism<undefined, a>>;

export type Schema<a, metadata = {}> = ISchema<a, metadata> & SchemaData<a, metadata>;

function makeSchema<a, metadata>(schemaData: SchemaData<a, metadata>): Schema<a, metadata> {
  return {
    ...schemaData,
    combine<b>(schema2: Schema<b, metadata>): Schema<readonly [a, b], metadata> {
      return makeSchema(
        data(
          "Combine",
          <r>(
            handler: (
              schema1: Schema<a, metadata>,
              schema2: Schema<b, metadata>,
              iso: Isomorphism<readonly [a, b], readonly [a, b]>,
            ) => r,
          ) => handler(this, schema2, iso<readonly [a, b]>()),
        ),
      );
    },
    map<b>(f: (a: a) => b): Schema<b, metadata> {
      return makeSchema(
        data("Map", <r>(handler: (f: (a: a) => b, schema: Schema<a, metadata>) => r) =>
          handler(f, this),
        ),
      );
    },
    or(schema2: Schema<a, metadata>): Schema<a, metadata> {
      return makeSchema(data("Or", [this, schema2] as const) as Schema<a, metadata>);
    },
    setMetadata(metadata) {
      return {
        ...this,
        metadata,
      };
    },
  };
}

export const Schema = {
  array<a, metadata = {}>(schema: Schema<a, metadata>): Schema<a[], metadata> {
    return makeSchema<a[], metadata>(
      data("Array", <r>(handler: (schema: Schema<a, metadata>, iso: Isomorphism<a[], a[]>) => r) =>
        handler(schema, iso<a[]>()),
      ),
    );
  },
  bool: <metadata = {}>() => makeSchema<boolean, metadata>(data("Bool", iso<boolean>())),
  date: <metadata = {}>() => makeSchema<Date, metadata>(data("Date", iso<Date>())),
  enumOf<a, arr extends readonly [a, ...a[]], metadata = {}>(
    options: arr,
  ): Schema<arr[number], metadata> {
    return Schema.oneOf(
      Schema.only(options[0]),
      ...options.slice(1).map(x => Schema.only<arr[number], metadata>(x)),
    );
  },
  field<a, metadata = {}>(field: string, schema: Schema<a, metadata>): Schema<a, metadata> {
    return makeSchema<a, metadata>(data("Field", { field, schema }));
  },
  null: <metadata = {}>() => makeSchema<null, metadata>(data("Null", iso<null>())),
  number: <metadata = {}>() => makeSchema<number, metadata>(data("Number", iso<number>())),
  oneOf<a, metadata = {}>(
    alt1: Schema<a, metadata>,
    ...rest: Schema<a, metadata>[]
  ): Schema<a, metadata> {
    return rest.reduce((a, b) => a.or(b), alt1);
  },
  only<a, metadata = {}>(a: a): Schema<a, metadata> {
    return makeSchema<a, metadata>(data("Only", a));
  },
  optional<a, metadata = {}>(schema: Schema<a, metadata>): Schema<Maybe<a>, metadata> {
    return makeSchema<Maybe<a>, metadata>(
      data(
        "Optional",
        <r>(handler: (schema: Schema<a, metadata>, iso: Isomorphism<Maybe<a>, Maybe<a>>) => r) =>
          handler(schema, iso<Maybe<a>>()),
      ),
    );
  },
  pure<a, metadata = {}>(a: a): Schema<a, metadata> {
    return makeSchema<a, metadata>(data("Pure", a));
  },
  record<r extends { [key: string]: any }, metadata = {}>(
    spec: { [k in keyof r]: Schema<r[k], metadata> },
  ): Schema<r, metadata> {
    return objectToEntries(spec).reduceRight<Schema<r, metadata>>(
      (r, [key, field]) => r.combine(field).map(([r_, field_]) => ({ ...r_, [key]: field_ })),
      Schema.pure({} as r),
    );
  },
  tuple<t extends any[], metadata = {}>(
    ...schemas: { [k in keyof t]: Schema<t[k], metadata> }
  ): Schema<t, metadata> {
    return schemas.reduceRight<Schema<t, metadata>>(
      (t, schema) => t.combine(schema).map(([t_, schema_]) => [...t_, schema_] as t),
      Schema.pure(([] as unknown) as t),
    );
  },
  string: <metadata = {}>() => makeSchema<string, metadata>(data("String", iso<string>())),
  undefined: <metadata = {}>() =>
    makeSchema<undefined, metadata>(data("Undefined", iso<undefined>())),
};
