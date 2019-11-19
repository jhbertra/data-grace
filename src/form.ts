import { Either, Left, lefts, Right, rights } from "./either";
import { Just, Maybe, Nothing } from "./maybe";
import { constant, objectFromEntries, objectToEntries } from "./prelude";
import { StructuredError } from "./structuredError";

export type FormError = StructuredError<string | number, string>;

export type FormValidator<input, a> = (input: input) => Either<FormError, a>;

export class Form<input, a = input> {
  private readonly result: Lazy<Either<FormError, a>>;

  constructor(
    public readonly value: input,
    public readonly validate: FormValidator<input, a>,
    public readonly dirty: boolean = false,
  ) {
    this.result = lazy(() => validate(value));
  }

  public chain<b>(f: (a: a) => Form<input, b>): Form<input, b> {
    return new Form(
      this.value,
      input => this.validate(input).chain(x => f(x).validate(input)),
      this.dirty,
    );
  }

  public getResult(): Either<FormError, a> {
    return this.result.value();
  }

  public load(value: input): Form<input, a> {
    return this.with({ value, dirty: false });
  }

  public map<b>(f: (a: a) => b): Form<input, b> {
    return this.chain(a => new Form(this.value, constant(Right(f(a)))));
  }

  public or(alt: Form<input, a>): Form<input, a> {
    return this.with({
      validate: input =>
        this.validate(input).matchCase({
          left: () => alt.validate(input),
          right: x => Right(x),
        }),
    });
  }

  public queryError(
    error: FormError,
    ...path: Array<string | number>
  ): Maybe<FormError> {
    return this.getResult()
      .leftToMaybe()
      .chain(x => StructuredError.query(x, ...path));
  }

  public setValue(value: input): Form<input, a> {
    return this.with({ value, dirty: true });
  }

  public with(updates: {
    readonly dirty?: boolean;
    readonly validate?: FormValidator<input, a>;
    readonly value?: input;
  }): Form<input, a> {
    return new Form(
      updates.value ?? this.value,
      updates.validate ?? this.validate,
      updates.dirty ?? this.dirty,
    );
  }
}

type Lazy<a> = {
  value(): a;
};

function lazy<a>(thunk: () => a): Lazy<a> {
  let value: a;

  return {
    value() {
      if (!value) {
        value = thunk();
      }
      return value;
    },
  };
}

export const Forms = {
  checkbox<a>(validate: FormValidator<boolean, a>): Form<boolean, a> {
    return new Form(false as boolean, validate);
  },
  options<a, b>(validate: FormValidator<a[], b>): Form<a[], b> {
    return new Form<a[], b>([], validate);
  },
  record<input extends object, a extends { [K in keyof input]: a[K] }>(
    spec: { [K in keyof input]: Form<input[K], a[K]> },
  ): Form<input, a> {
    return new Form(
      objectFromEntries(
        objectToEntries(spec).map<[keyof input, input[keyof input]]>(
          ([key, value]) => [key, value.value],
        ),
      ),
      input => {
        const results = objectToEntries(spec).map(([key, form]) =>
          form
            .validate(input[key])
            .map<[keyof a, a[keyof a]]>(x => [key, x])
            .mapLeft(error => StructuredError.Path(key as string, error)),
        );

        const errors = lefts(results);

        return errors.isEmpty()
          ? Right(objectFromEntries(rights(results)))
          : Left(StructuredError.Multiple(errors));
      },
    );
  },
  select<a, b>(validate: FormValidator<Maybe<a>, b>): Form<Maybe<a>, b> {
    return new Form(Nothing(), validate);
  },
  setField<input extends object, field extends keyof input, a>(
    field: field,
    value: input[field],
    form: Form<input, a>,
  ): Form<input, a> {
    return form.setValue({
      ...form.value,
      [field]: value,
    });
  },
  slider<a>(validate: FormValidator<number, a>): Form<number, a> {
    return new Form(0 as number, validate);
  },
  text<a>(validate: FormValidator<string, a>): Form<string, a> {
    return new Form("" as string, validate);
  },
  tuple<input extends any[], a extends { [K in keyof input]: a[K] }>(
    ...forms: { [K in keyof input]: Form<input[K], a[K]> }
  ): Form<input, a> {
    return new Form(forms.map(x => x.value) as input, input => {
      const results = forms.map((form, i) =>
        form
          .validate(input[i])
          .mapLeft(error => StructuredError.Path(i, error)),
      );

      const errors = lefts(results);

      return errors.isEmpty()
        ? Right(rights(results) as any)
        : Left(StructuredError.Multiple(errors));
    });
  },
};
