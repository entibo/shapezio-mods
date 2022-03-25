import { Loader } from "shapez/core/loader"
import {
  enumDirection,
  enumInvertedDirections,
  Vector,
} from "shapez/core/vector"
import { BaseItem } from "shapez/game/base_item"
import { Component } from "shapez/game/component"
import {
  ItemAcceptorComponent,
  ItemAcceptorSlotConfig,
} from "shapez/game/components/item_acceptor"
import { ItemEjectorComponent } from "shapez/game/components/item_ejector"
import { Entity } from "shapez/game/entity"
import { defaultBuildingVariant } from "shapez/game/meta_building"
import { ModMetaBuilding } from "shapez/mods/mod_meta_building"
import { types } from "shapez/savegame/serialization"
import { CompactMachine } from "."
import { override } from "../override"
import {
  HiddenBuilding,
  ItemPassOver,
  RegisterComponent,
  RegisterNewBuilding,
} from "../decorators"
import {
  Direction,
  getComponent,
  invertedDirection,
  rotatedDirection,
} from "../util"

@override()
//@ts-expect-error
export class CompactMachineRelay extends Entity {
  get relay() {
    return getComponent(this, CompactMachineRelayComponent)
  }
}

export function isCompactMachineRelay<T extends Entity>(
  entity: T
): entity is T & CompactMachineRelay {
  return !!getComponent(entity, CompactMachineRelayComponent)
}

//-----------------------------------------------------------------------------

@HiddenBuilding()
@RegisterNewBuilding({})
export class ModMetaCompactMachineRelayBuilding extends ModMetaBuilding {
  static getAllVariantCombinations() {
    return [
      {
        name: "",
        description: "",
        variant: defaultBuildingVariant,
      },
    ]
  }

  //@ts-expect-error
  setupEntityComponents(entity: Entity) {
    entity.addComponent(new CompactMachineRelayComponent())
    const slots: ItemAcceptorSlotConfig[] = []
    for (let i = 0; i < 4; i++) {
      slots.push({
        pos: new Vector(i, 0),
        direction: enumDirection.top,
      })
      slots.push({
        pos: new Vector(i, 3),
        direction: enumDirection.bottom,
      })
      slots.push({
        pos: new Vector(0, i),
        direction: enumDirection.left,
      })
      slots.push({
        pos: new Vector(3, i),
        direction: enumDirection.right,
      })
    }
    entity.addComponent(
      new ItemAcceptorComponent({
        slots,
      })
    )
    entity.addComponent(
      new ItemEjectorComponent({
        slots,
        renderFloatingItems: false,
      })
    )
  }

  //@ts-expect-error
  getSprite(rotationVariant: number, variant: string): AtlasSprite {
    return Loader.getSprite("sprites/transparent.png")
  }
  //@ts-expect-error
  getSilhouetteColor() {
    return "transparent"
  }

  //@ts-expect-error
  getDimensions(variant?: string): Vector {
    return new Vector(4, 4)
  }
  //@ts-expect-error
  getIsRemovable(root: GameRoot): boolean {
    return false
  }
  //@ts-expect-error
  getIsReplaceable(): boolean {
    return false
  }
  //@ts-expect-error
  getIsUnlocked(root: GameRoot): boolean {
    return false
  }
}

@RegisterComponent()
@ItemPassOver()
export class CompactMachineRelayComponent extends Component {
  targetCompactMachines: Record<Direction, CompactMachine | null> = {
    left: null,
    right: null,
    top: null,
    bottom: null,
  }

  clearTarget(direction: Direction) {
    this.targetCompactMachines[direction] = null
  }
  hasAnyTarget() {
    return Object.values(this.targetCompactMachines).some((e) => e !== null)
  }
  tryTakeItem(item: BaseItem, direction: Direction) {
    const cm = this.targetCompactMachines[direction]
    if (!cm) return false
    direction = rotatedDirection(direction, cm.static.rotation)
    const ejectDirection = invertedDirection[direction]
    const ejectorComp = cm.components.ItemEjector
    for (let slotIndex = 0; slotIndex < ejectorComp.slots.length; slotIndex++) {
      const slot = ejectorComp.slots[slotIndex]
      if (slot.direction !== ejectDirection) continue
      return ejectorComp.tryEject(slotIndex, item)
    }
    return false
  }
}
