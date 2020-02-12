import * as fc from "fast-check";
import { Form, FormError, Result } from "../src";
import { simplify, constant } from "../src/prelude";
import { arbitraryEither } from "./result.spec";

describe("chain", () => {
  it("short circuits if the first Form fails", () => {
    expect(
      simplify(
        Form.fail(undefined, FormError.Failure("Fail"))
          .chain(constant(Form.succeed(undefined, "test")))
          .getResult(),
      ),
    ).toEqual(simplify(Result.Error(FormError.Failure("Fail"))));
  });
  it("runs the second Form if the first Form fails", () => {
    expect(
      simplify(
        Form.succeed(undefined, "first")
          .chain(constant(Form.succeed(undefined, "test")))
          .getResult(),
      ),
    ).toEqual(simplify(Result.Ok("test")));
  });
});

describe("getResult", () => {
  it("returns the result of the validator fn", () => {
    fc.assert(
      fc.property(arbitraryEither(arbitraryFormError, fc.anything()), x => {
        expect(simplify(Form.text(constant(x)).getResult())).toEqual(simplify(x));
      }),
    );
  });
});

describe("load", () => {
  it("sets the value of the form", () => {
    fc.assert(
      fc.property(
        fc.string(),
        arbitraryEither(arbitraryFormError, fc.anything()),
        (value, result) => {
          expect(Form.text(constant(result)).load(value).value).toEqual(value);
        },
      ),
    );
  });
  it("does not set the dirty flag", () => {
    fc.assert(
      fc.property(
        fc.string(),
        arbitraryEither(arbitraryFormError, fc.anything()),
        (value, result) => {
          expect(Form.text(constant(result)).load(value).dirty).toEqual(false);
        },
      ),
    );
  });
  it("updates the result", () => {
    fc.assert(
      fc.property(fc.string(), value => {
        expect(
          simplify(
            Form.text(x =>
              x.length % 2 === 0 ? Result.Error(FormError.Failure("fail")) : Result.Ok("success"),
            )
              .load(value)
              .getResult(),
          ),
        ).toEqual(
          simplify(
            value.length % 2 === 0 ? Result.Error(FormError.Failure("fail")) : Result.Ok("success"),
          ),
        );
      }),
    );
  });
});

const arbitraryFormError: fc.Arbitrary<FormError> = fc.oneof<FormError>(
  fc.string().map(FormError.Failure),
  fc.array(fc.string().map(FormError.Failure)).map(FormError.Multiple),
  fc.array(fc.string().map(FormError.Failure)).map(FormError.Or),
  fc
    .record({
      key: fc.oneof<string | number>(fc.string(), fc.nat()),
      error: fc.string().map(FormError.Failure),
    })
    .map(FormError.Path),
);
