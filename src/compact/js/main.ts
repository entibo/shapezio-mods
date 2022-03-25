import { Rectangle } from "shapez/core/rectangle"
import { StaleAreaDetector } from "shapez/core/stale_area_detector"
import { Vector } from "shapez/core/vector"
import { Entity } from "shapez/game/entity"
import { Mod } from "shapez/mods/mod"
import "./logic/compact_system"
import { override } from "./override"
import { signals } from "./signals"

class ModImpl extends Mod {
  init() {
    signals.modInit.dispatch(this.modInterface)
  }
}

// Split into multiple areas if it gets too large
@override()
class LimitUnionArea extends StaleAreaDetector {
  staleAreas!: Rectangle[] | null
  invalidate(area: Rectangle) {
    this.staleAreas = this.staleAreas || []
    if (this.staleAreas.length > 100) return
    for (let i = 0; i < this.staleAreas.length; ++i) {
      const union = this.staleAreas[i].getUnion(area)
      if (union.w * union.h < 1000) {
        this.staleAreas[i] = union
        return
      }
    }
    // There were no areas or they were all too large
    this.staleAreas.push(area.clone())
  }
  update() {
    if (!this.staleAreas || !this.staleAreas.length) return
    for (const staleArea of this.staleAreas) {
      this.staleArea = staleArea
      super.update()
    }
    //@ts-ignore
    this.staleArea = null
    this.staleAreas = []
  }
}

@override()
class _Rectangle extends Rectangle {
  *[Symbol.iterator]() {
    for (let x = this.x; x < this.x + this.w; ++x) {
      for (let y = this.y; y < this.y + this.h; ++y) {
        yield [x, y] as const
      }
    }
  }
}
@override()
class _Vector extends Vector {
  get xy() {
    return [this.x, this.y] as readonly [number, number]
  }
}

@override()
//@ts-expect-error
class _Entity extends Entity {
  get static() {
    return this.components.StaticMapEntity
  }
}
