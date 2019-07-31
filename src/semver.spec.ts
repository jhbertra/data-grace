// tslint:disable: max-line-length
import * as p from "../package.json";
import * as array from "./array";
import * as index from "./index";
import { Equals, prove } from "./prelude";
import * as prelude from "./prelude";

describe("package.json", () => {
  it("Is on version 0.0.0", () => {
    expect(p.version).toEqual("0.0.0");
  });
});

/*------------------------------
  INDEX
  ------------------------------*/

prove<Equals<
  typeof index,
  typeof prelude & {
    array: any,
    codec: any,
    decoder: any,
    either: any,
    encoder: any,
    maybe: any,
    promise: any,
    validation: any,
  }
>>("Detected non-breaking change to root API. This requires a MINOR update.");

/*------------------------------
  ARRAY API
  ------------------------------*/

prove<Equals<typeof array.unzip, <A, B>(abs: Array<[A, B]>) => [A[], B[]]>>("Detected breaking change in array.unzip. This requires a MAJOR update.");
prove<Equals<typeof array.zipWith, <A, B, C>(f: (a: A, b: B) => C, as: A[], bs: B[]) => C[]>>("Detected breaking change in array.zipWith. This requires a MAJOR update.");
prove<Equals<typeof array, { unzip: any, zipWith: any }>>("Detected non-breaking change to array API. This requires a MINOR update.");
