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
import { THEME } from "shapez/game/theme"
import { ModMetaBuilding } from "shapez/mods/mod_meta_building"
import { types } from "shapez/savegame/serialization"

import {
  AddNewBuildingToToolbar,
  ItemPassOver,
  RegisterComponent,
  RegisterNewBuilding,
} from "../decorators"
import multiPng from "../../res/sprites/multi.png"
import { Direction, getComponent, invertedDirection } from "../util"
import Zone from "../logic/Zone"
import { CompactMachineRelay } from "./CompactMachineRelay"
import { override } from "../override"

@override()
//@ts-expect-error
export class CompactMachine extends Entity {
  get compact() {
    return getComponent(this, CompactMachineComponent)
  }
}

export function isCompactMachine<T extends Entity>(
  entity: T
): entity is T & CompactMachine {
  return !!getComponent(entity, CompactMachineComponent)
}

//-----------------------------------------------------------------------------

@RegisterNewBuilding({ buildingIconBase64: multiPng })
@AddNewBuildingToToolbar({ toolbar: "regular", location: "primary" })
export class ModMetaCompactMachineBuilding extends ModMetaBuilding {
  static getAllVariantCombinations() {
    return [
      {
        name: "Compact machine",
        description: "Double click to enter.",
        variant: defaultBuildingVariant,

        // regularImageBase64: multiPng,
        // blueprintImageBase64: multiPng,
        tutorialImageBase64: multiPng,
      },
    ]
  }

  //@ts-expect-error
  setupEntityComponents(entity: Entity) {
    entity.addComponent(new CompactMachineComponent())
    const slots: ItemAcceptorSlotConfig[] = []
    for (const direction of Object.values(enumDirection)) {
      slots.push({
        pos: new Vector(0, 0),
        direction,
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
        renderFloatingItems: true,
      })
    )
  }

  //@ts-expect-error
  getSprite(rotationVariant: number, variant: string): AtlasSprite {
    // return Loader.getSprite("sprites/buildings/multi.png")
    return Loader.getSprite("sprites/transparent.png")
    // return Loader.getSprite("sprites/buildings/compact.png")
  }
  //@ts-expect-error
  getBlueprintSprite(rotationVariant?: number, variant?: string): AtlasSprite {
    return Loader.getSprite("sprites/blueprints/compact.png")
  }
  //@ts-expect-error
  getPreviewSprite(rotationVariant?: number, variant?: string): AtlasSprite {
    return Loader.getSprite("sprites/buildings/compact.png")
  }

  //@ts-expect-error
  getSilhouetteColor() {
    return THEME.map.zone.borderSolid
  }
  //@ts-expect-error
  getSpecialOverlayRenderMatrix(
    rotation: number,
    rotationVariant: number,
    variant: string,
    entity: Entity
  ): number[] {
    return [1, 1, 1, 1, 0, 1, 1, 1, 1]
  }

  //@ts-expect-error
  getDimensions(variant: string): Vector {
    return new Vector(1, 1)
  }
  //@ts-expect-error
  getRenderPins(): boolean {
    return true
  }
  //@ts-expect-error
  getIsUnlocked(root: GameRoot) {
    return true
  }
}

@RegisterComponent()
@ItemPassOver()
export class CompactMachineComponent extends Component {
  zoneId: number | null = null
  zone: Zone | null = null
  offset = new Vector(0, 0)
  targetRelays: Record<Direction, CompactMachineRelay | null> = {
    left: null,
    right: null,
    top: null,
    bottom: null,
  }
  contents: { entities: Entity[]; rotation: number } | null = null

  static getSchema() {
    return {
      zoneId: types.nullable(types.uint),
      offset: types.tileVector,
    }
  }

  copyAdditionalStateTo(otherComponent: CompactMachineComponent): void {
    otherComponent.contents = this.contents
    otherComponent.zone = this.zone
    otherComponent.offset = this.offset
  }

  tryTakeItem(item: BaseItem, direction: Direction) {
    const cmr = this.targetRelays[direction]
    if (!cmr) return false
    const ejectDirection = invertedDirection[direction]
    const ejectorComp = cmr.components.ItemEjector
    for (let slotIndex = 0; slotIndex < ejectorComp.slots.length; slotIndex++) {
      const slot = ejectorComp.slots[slotIndex]
      if (slot.direction !== ejectDirection) continue
      if (ejectorComp.tryEject(slotIndex, item)) {
        return true
      }
    }
    return false
  }
}
