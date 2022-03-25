/**
 * Patch a `target` class with methods from `source`
 * Can be used as a decorator
 * @param source `class extends target` - should not be re-used after this
 * @return a function that can be called to undo the changes
 **/
export const override = ((source) => {
  if (!source) return override
  // Get the parent class or fail
  const target = Object.getPrototypeOf(source.prototype).constructor
  if (target === Object || !target)
    throw new Error("override: class needs to extend a target class")

  const mgr = ClassOverrideManager.for(target).add(source)
  return () => {
    mgr.remove(source)
  }
}) as <C extends Class | undefined = undefined>(
  source?: C
) => C extends undefined ? <C extends Class>(source: C) => C : () => void

type Class = { new (...args: any): any }
type Prototype = Record<PropertyKey, any>

class ClassOverrideManager {
  private staticMgr: PrototypeChainManager
  private protoMgr: PrototypeChainManager
  constructor(public target: Class) {
    this.target = target
    this.staticMgr = new PrototypeChainManager(target, true)
    this.protoMgr = new PrototypeChainManager(target.prototype, false)
  }

  add(source: Class) {
    this.staticMgr.add(source)
    this.protoMgr.add(source.prototype)
    return this
  }
  remove(source: Class) {
    this.staticMgr.remove(source)
    this.protoMgr.remove(source.prototype)
    return this
  }

  static map = new Map<Class, ClassOverrideManager>()
  static for(target: Class) {
    let inst = this.map.get(target)
    if (inst) return inst
    inst = new ClassOverrideManager(target)
    this.map.set(target, inst)
    return inst
  }
}

class PrototypeChainManager {
  private current: Prototype
  private patchedProps = new Set<PropertyKey>()
  constructor(public target: Prototype, private isConstructor: boolean) {
    // `target` will be patched, so its properties need to be cloned
    this.current = Object.defineProperties(
      {},
      Object.getOwnPropertyDescriptors(target)
    )
    Object.setPrototypeOf(this.current, Object.getPrototypeOf(target))
  }
  add(source: Prototype) {
    // Add source at the beginning of the chain
    Object.setPrototypeOf(source, this.current)
    this.current = source

    // Patch properties on the target to use our chain
    for (const key of Reflect.ownKeys(
      Object.getOwnPropertyDescriptors(source)
    )) {
      const desc = Object.getOwnPropertyDescriptor(source, key)
      if (!desc) continue
      // Skip special properties
      if (this.isConstructor) {
        if (key === "name" || key === "length" || key === "prototype") continue
      } else if (key === "constructor") continue

      // This could be used to later un-patch properties
      if (this.patchedProps.has(key)) continue
      this.patchedProps.add(key)

      const that = this
      if (desc.get || desc.set) {
        Object.defineProperty(this.target, key, {
          configurable: true,
          enumerable: false,
          get() {
            return Reflect.get(that.current, key, this)
          },
          set: function (value) {
            Reflect.set(that.current, key, value, this)
          },
        })
      } else {
        Object.defineProperty(this.target, key, {
          configurable: true,
          enumerable: false,
          value: function () {
            return Reflect.apply(that.current[key], this, arguments)
          },
        })
      }
    }
  }
  remove(source: Prototype) {
    // Walk up the prototype chain to find source
    let prev
    let cur = this.current
    while (cur && cur !== source) {
      prev = cur
      cur = Object.getPrototypeOf(cur)
    }

    // Source wasn't in the chain
    if (!cur) return

    // Remove source from the chain
    const next = Object.getPrototypeOf(cur)
    if (prev) Object.setPrototypeOf(prev, next)
    else this.current = next
  }
}
