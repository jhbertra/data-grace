export type Void = never;

export function absurd<T>(_: Void): T {
    throw "absurd";
}