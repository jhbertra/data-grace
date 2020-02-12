import { Either } from "./either";
import { Maybe } from "./maybe";
import { Lazy } from "./lazy";
import {
  constant,
  objectFromEntries,
  objectToEntries,
  Constructors,
  Constructor,
  traverseObject,
} from "./prelude";
import { StructuredError } from "./structuredError";

export type FormError = StructuredError<string | number, string>;

export const FormError = Constructors({
  Failure: Constructor<string>(),
  Multiple: Constructor<FormError[]>(),
  Or: Constructor<FormError[]>(),
  Path: Constructor<{ key: string | number; error: FormError }>(),
});

export type FormValidator<input, a> = (input: input) => Either<FormError, a>;

export class Form<input, a = input> {
  private readonly result: Lazy<Either<FormError, a>>;

  constructor(
    public readonly value: input,
    public readonly validate: FormValidator<input, a>,
    public readonly dirty: boolean = false,
  ) {
    this.result = Lazy.delay(() => validate(value));
  }

  public chain<b>(f: (a: a) => Form<input, b>): Form<input, b> {
    return new Form(
      this.value,
      input => this.validate(input).chain(x => f(x).validate(input)),
      this.dirty,
    );
  }

  public getResult(): Either<FormError, a> {
    return this.result.force();
  }

  public load(value: input): Form<input, a> {
    return this.with({ value, dirty: false });
  }

  public map<b>(f: (a: a) => b): Form<input, b> {
    return this.chain(a => new Form(this.value, constant(Either.Right(f(a)))));
  }

  public or(alt: Form<input, a>): Form<input, a> {
    return this.with({
      validate: input =>
        this.validate(input).matchCase({
          left: () => alt.validate(input),
          right: x => Either.Right(x),
        }),
    });
  }

  public queryError(...path: Array<string | number>): Maybe<FormError> {
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

  public static checkbox<a>(validate: FormValidator<boolean, a>): Form<boolean, a> {
    return new Form(false as boolean, validate);
  }

  public static fail<a, b>(value: a, error: FormError): Form<a, b> {
    return new Form(value, constant(Either.Left(error)));
  }

  public static options<a, b>(validate: FormValidator<a[], b>): Form<a[], b> {
    return new Form<a[], b>([], validate);
  }

  public static record<input extends object, a extends { [K in keyof input]: a[K] }>(
    spec: { [K in keyof input]: Form<input[K], a[K]> },
  ): Form<input, a> {
    return new Form(
      traverseObject(spec, (_key, value) => value.value),
      input => {
        const results = objectToEntries(spec).map(([key, form]) =>
          form
            .validate(input[key])
            .map(x => [key, x] as const)
            .mapLeft(error => FormError.Path({ key: key as string, error })),
        );

        const errors = Either.lefts(results);

        return errors.isEmpty()
          ? Either.Right(objectFromEntries(Either.rights(results)))
          : Either.Left(FormError.Multiple(errors));
      },
    );
  }

  public static select<a, b>(validate: FormValidator<Maybe<a>, b>): Form<Maybe<a>, b> {
    return new Form(Maybe.Nothing(), validate);
  }

  public static setField<input extends object, field extends keyof input, a>(
    field: field,
    value: input[field],
    form: Form<input, a>,
  ): Form<input, a> {
    return form.setValue({
      ...form.value,
      [field]: value,
    });
  }

  public static slider<a>(validate: FormValidator<number, a>): Form<number, a> {
    return new Form(0 as number, validate);
  }

  public static succeed<a, b>(value: a, result: b): Form<a, b> {
    return new Form(value, constant(Either.Right(result)));
  }

  public static text<a>(validate: FormValidator<string, a>): Form<string, a> {
    return new Form("" as string, validate);
  }

  public static tuple<input extends any[], a extends { [K in keyof input]: a[K] }>(
    ...forms: { [K in keyof input]: Form<input[K], a[K]> }
  ): Form<input, a> {
    return new Form(forms.map(x => x.value) as input, input => {
      const results = forms.map((form, i) =>
        form.validate(input[i]).mapLeft(error => FormError.Path({ key: i, error })),
      );

      const errors = Either.lefts(results);

      return errors.isEmpty()
        ? Either.Right(Either.rights(results) as any)
        : Either.Left(FormError.Multiple(errors));
    });
  }
}
