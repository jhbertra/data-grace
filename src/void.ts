export type Void = never;

export function absurd<T>(a: Void): T {
    throw "absurd";
}