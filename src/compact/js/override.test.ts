import { override } from "./override"

class A {
  constructor(public a: number) {}
  getA(): any {
    return this.a
  }
  static foo() {
    return "foo"
  }
}

const testBaseBehavior = () => expect(new A(5).getA()).toBe(5)

test("Control", testBaseBehavior)

function testOverrideThenRemove(
  desc: string,
  klass: new (...args: any) => any,
  runTests: () => void
) {
  test(desc, () => {
    const remove = override(klass)
    runTests()
    remove()
    testBaseBehavior()
  })
}

testOverrideThenRemove(
  "Simple override",
  class extends A {
    getA() {
      return 42
    }
  },
  () => {
    expect(new A(5).getA()).toBe(42)
  }
)

testOverrideThenRemove(
  "Simple override 2",
  class extends A {
    getA() {
      return this.a + 1
    }
  },
  () => {
    expect(new A(5).getA()).toBe(6)
  }
)

testOverrideThenRemove(
  "Using super",
  class extends A {
    getA() {
      return super.getA() + 1
    }
  },
  () => {
    expect(new A(5).getA()).toBe(6)
  }
)

test("Multiple overrides", () => {
  expect(new A(5).getA()).toBe(5)

  const Plus1 = class Plus1 extends A {
    getA() {
      return super.getA() + 1
    }
  }
  const Exclamation = class Exclamation extends A {
    getA() {
      return super.getA().toString() + "!"
    }
  }
  const Dollars = class Dollars extends A {
    getA() {
      return `Dollars/${this.a}/${super.getA()}`
    }
  }

  let removePlus1 = override(Plus1)
  expect(new A(5).getA()).toBe(6)

  let removeExclamation = override(Exclamation)
  expect(new A(5).getA()).toBe("6!")

  let removeDollars = override(Dollars)
  expect(new A(5).getA()).toBe("Dollars/5/6!")

  removeDollars()
  expect(new A(5).getA()).toBe("6!")

  removeDollars = override(Dollars)
  expect(new A(5).getA()).toBe("Dollars/5/6!")

  removePlus1()
  expect(new A(5).getA()).toBe("Dollars/5/5!")

  // Order is now different
  removePlus1 = override(Plus1)
  expect(new A(5).getA()).toBe("Dollars/5/5!1")

  removeDollars()
  expect(new A(5).getA()).toBe("5!1")

  removeExclamation()
  expect(new A(5).getA()).toBe(6)

  removePlus1()
  testBaseBehavior()
})

class B extends A {
  constructor() {
    super(5)
  }
  static bar() {
    return this.foo() + " bar"
  }
  static bar_super() {
    return super.foo() + " bar_super"
  }
}

test("Static methods", () => {
  expect(A.foo()).toBe("foo")
  let removeNot = override(
    class extends A {
      static foo() {
        return "not foo"
      }
    }
  )
  expect(A.foo()).toBe("not foo")
  removeNot()
  expect(A.foo()).toBe("foo")
})

test("Static methods, inheritance", () => {
  expect(B.foo()).toBe("foo")
  let removeNot = override(
    class extends B {
      static foo() {
        return "not foo"
      }
    }
  )
  expect(A.foo()).toBe("foo")
  expect(B.foo()).toBe("not foo")
  removeNot()
  expect(B.foo()).toBe("foo")
})

test("Static methods, bar", () => {
  expect(B.bar()).toBe("foo bar")
  expect(B.bar_super()).toBe("foo bar_super")
  let removeJoin = override(
    class extends B {
      static bar() {
        return [this.foo(), super.bar(), super.bar_super()].join("/")
      }
    }
  )
  expect(B.bar()).toBe("foo/foo bar/foo bar_super")
  expect(B.bar_super()).toBe("foo bar_super")
  removeJoin()
  expect(B.bar()).toBe("foo bar")
  expect(B.bar_super()).toBe("foo bar_super")
})

test("Static methods, bar 2", () => {
  expect(B.bar()).toBe("foo bar")
  expect(B.bar_super()).toBe("foo bar_super")
  let removeJoin = override(
    class extends B {
      static foo() {
        return "oof"
      }
      static bar_super() {
        return [this.foo(), super.bar(), super.bar_super()].join("/")
      }
    }
  )
  expect(B.bar()).toBe("oof bar")
  expect(B.bar_super()).toBe("oof/oof bar/foo bar_super")
  removeJoin()
  expect(B.bar()).toBe("foo bar")
  expect(B.bar_super()).toBe("foo bar_super")
})

class C {
  static get staticValue() {
    return 1000
  }
  __value = 0
  get value() {
    return this.__value
  }
  set value(x: number) {
    this.__value = x
  }
}

test("Getters", () => {
  expect(new C().value).toBe(0)
  let c = new C()
  c.value = 5
  expect(c.value).toBe(5)

  let remove = override(
    class extends C {
      get value() {
        return 42 + super.value
      }
    }
  )
  expect(new C().value).toBe(42)
  remove()
  expect(new C().value).toBe(0)
})

test("Static getters", () => {
  expect(C.staticValue).toBe(1000)

  let remove = override(
    class extends C {
      static get staticValue() {
        return super.staticValue + 1
      }
    }
  )
  expect(C.staticValue).toBe(1001)
  remove()
  expect(C.staticValue).toBe(1000)
})
