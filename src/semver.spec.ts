// tslint:disable: max-line-length
import * as p from "../package.json";
import * as array from "./array";
import { Equals, prove } from "./prelude";

describe("package.json", () => {
  it("Is on version 0.0.0", () => {
    expect(p.version).toEqual("0.0.0");
  });
});

/*------------------------------
  ARRAY API
  ------------------------------*/

prove<Equals<typeof array.unzip, <A, B>(abs: Array<[A, B]>) => [A[], B[]]>>("Detected breaking change in array.unzip. This requires a MAJOR update.");
prove<Equals<typeof array.zipWith, <A, B, C>(f: (a: A, b: B) => C, as: A[], bs: B[]) => C[]>>("Detected breaking change in array.zipWith. This requires a MAJOR update.");
prove<Equals<typeof array, { unzip: any, zipWith: any }>>("Detected non-breaking change to array API. This requires a MINOR update.");
