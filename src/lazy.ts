export interface Lazy<a> {
  force(): a;
  chain<b>(f: (a: a) => Lazy<b>): Lazy<b>;
  combine<b>(b: Lazy<b>): Lazy<readonly [a, b]>;
  map<b>(f: (a: a) => b): Lazy<b>;
}

export const Lazy = {
  delay<a>(valueFactory: () => a): Lazy<a> {
    let a: a;
    return {
      force() {
        if (!a) {
          a = valueFactory();
        }
        return a;
      },
      chain(f) {
        return Lazy.delay(() => f(this.force()).force());
      },
      combine(b) {
        return Lazy.delay(() => [this.force(), b.force()] as const);
      },
      map(f) {
        return Lazy.delay(() => f(this.force()));
      },
    };
  },
  pure<a>(value: a): Lazy<a> {
    return {
      force() {
        return value;
      },
      chain(f) {
        return Lazy.delay(() => f(value).force());
      },
      combine(b) {
        return Lazy.delay(() => [value, b.force()] as const);
      },
      map(f) {
        return Lazy.delay(() => f(value));
      },
    };
  },
};
