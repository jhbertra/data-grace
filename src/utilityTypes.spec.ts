import { prove, proveNever } from "./prelude";
import { Cons, Curry, Equals, Head, IsEmpty, Tail } from "./utilityTypes";

prove<Equals<Cons<string, [number, boolean]>, [string, number, boolean]>>(
  "proof",
);
prove<Equals<Cons<string, [number, boolean]>, [string, number, boolean]>>(
  "proof",
);
prove<
  Equals<
    Curry<[string, boolean, number], string>,
    (arg: string) => (arg: boolean) => (arg: number) => string
  >
>("proof");
prove<Equals<Head<[string, number, boolean]>, string>>("proof");
proveNever<Head<[]>>();
prove<Equals<IsEmpty<[string, number, boolean]>, false>>("proof");
prove<Equals<IsEmpty<[]>, true>>("proof");
prove<Equals<Tail<[string, number, boolean]>, [number, boolean]>>("proof");
