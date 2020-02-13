import { Result } from "./result";
import { Maybe } from "./maybe";
import { Lazy } from "./lazy";
import { constant, objectFromEntries, objectToEntries, traverseObject } from "./prelude";
import { StructuredError } from "./structuredError";

export type FormError = StructuredError<string | number, string>;

export type FormValidator<input, a> = (input: input) => Result<a, FormError>;

export class Form<input, a = input> {
  private readonly result: Lazy<Result<a, FormError>>;

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

  public getResult(): Result<a, FormError> {
    return this.result.force();
  }

  public load(value: input): Form<input, a> {
    return this.with({ value, dirty: false });
  }

  public map<b>(f: (a: a) => b): Form<input, b> {
    return this.chain(a => new Form(this.value, constant(Result.Ok(f(a)))));
  }

  public or(alt: Form<input, a>): Form<input, a> {
    return this.with({
      validate: input =>
        this.validate(input).matchCase({
          Error: () => alt.validate(input),
          Ok: x => Result.Ok(x),
        }),
    });
  }

  public queryError(...path: Array<string | number>): Maybe<FormError> {
    return this.getResult().maybeError.chain(x => x.query(...path));
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
    return new Form(value, constant(Result.Error(error)));
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
            .mapError(error => StructuredError.Path(key as string, error)),
        );

        const errors = Result.errors(results);

        return errors.isEmpty()
          ? Result.Ok(objectFromEntries(Result.oks(results)))
          : Result.Error(StructuredError.Multiple(errors));
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
    return new Form(value, constant(Result.Ok(result)));
  }

  public static text<a>(validate: FormValidator<string, a>): Form<string, a> {
    return new Form("" as string, validate);
  }

  public static tuple<input extends any[], a extends { [K in keyof input]: a[K] }>(
    ...forms: { [K in keyof input]: Form<input[K], a[K]> }
  ): Form<input, a> {
    return new Form(forms.map(x => x.value) as input, input => {
      const results = forms.map((form, i) =>
        form.validate(input[i]).mapError(error => StructuredError.Path(i, error)),
      );

      const errors = Result.errors(results);

      return errors.isEmpty()
        ? Result.Ok(Result.oks(results) as any)
        : Result.Error(StructuredError.Multiple(errors));
    });
  }
}
