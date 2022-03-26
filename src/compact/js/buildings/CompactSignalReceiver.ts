import { Loader } from "shapez/core/loader"
import { generateMatrixRotations } from "shapez/core/utils"
import { enumDirection, Vector } from "shapez/core/vector"
import { Component } from "shapez/game/component"
import {
  enumPinSlotType,
  WiredPinsComponent,
} from "shapez/game/components/wired_pins"
import { Entity } from "shapez/game/entity"
import { GameSystemWithFilter } from "shapez/game/game_system_with_filter"
import { ColorItem } from "shapez/game/items/color_item"
import { MetaBuilding } from "shapez/game/meta_building"
import { GameRoot } from "shapez/game/root"
import { WireNetwork } from "shapez/game/systems/wire"
import { THEME } from "shapez/game/theme"
import toolbarIcon from "../../res/sprites/compact-signal-toolbar.png"
import {
  AddNewBuildingToToolbar,
  RegisterComponent,
  RegisterGameSystem,
  RegisterNewBuilding,
} from "../decorators"
import { getComponent } from "../util"

export function isCompactSignalReceiver<T extends Entity>(
  entity: T
): entity is T {
  return !!getComponent(entity, CompactSignalReceiverComponent)
}

//-----------------------------------------------------------------------------

enum CompactSignalReceiverVariant {
  receiver = "default",
  transmitter = "transmitter",
}

@RegisterNewBuilding({ buildingIconBase64: toolbarIcon })
@AddNewBuildingToToolbar({ toolbar: "wires", location: "secondary" })
export class MetaCompactSignalReceiverBuilding extends MetaBuilding {
  static getAllVariantCombinations() {
    return [
      {
        name: "Compact Signal Receiver",
        description: "",
        variant: CompactSignalReceiverVariant.receiver,

        // regularImageBase64: multiPng,
        // blueprintImageBase64: multiPng,
        tutorialImageBase64: toolbarIcon,
      },
      // {
      //   name: "Compact Signal Transmitter",
      //   description: "",
      //   variant: CompactSignalReceiverVariant.transmitter,

      //   // regularImageBase64: multiPng,
      //   // blueprintImageBase64: multiPng,
      //   tutorialImageBase64: toolbarIcon,
      // },
    ]
  }

  getAvailableVariants() {
    return [
      CompactSignalReceiverVariant.receiver,
      // CompactSignalReceiverVariant.transmitter,
    ]
  }

  getLayer(): Layer {
    return "wires"
  }

  setupEntityComponents(entity: Entity) {
    entity.addComponent(
      new WiredPinsComponent({
        slots: [],
      })
    )
    entity.addComponent(new CompactSignalReceiverComponent())
  }

  updateVariants(
    entity: Entity,
    _rotationVariant: number,
    variant: string
  ): void {
    const slotType =
      variant === CompactSignalReceiverVariant.receiver
        ? enumPinSlotType.logicalAcceptor
        : enumPinSlotType.logicalEjector
    entity.components.WiredPins.setSlots([
      {
        pos: new Vector(0, 0),
        direction: enumDirection.bottom,
        type: slotType,
      },
    ])
  }

  //@ts-expect-error
  getSprite(rotationVariant: number, variant: string): AtlasSprite {
    // return Loader.getSprite("sprites/buildings/multi.png")
    return Loader.getSprite("sprites/buildings/compact-signal-receiver.png")
    // return Loader.getSprite("sprites/buildings/compact.png")
  }
  //@ts-expect-error
  getBlueprintSprite(rotationVariant?: number, variant?: string): AtlasSprite {
    return Loader.getSprite("sprites/blueprints/compact-signal-receiver.png")
  }
  //@ts-expect-error
  getPreviewSprite(rotationVariant?: number, variant?: string): AtlasSprite {
    return Loader.getSprite("sprites/buildings/compact.png")
  }

  getSilhouetteColor() {
    return THEME.map.zone.borderSolid
  }

  getSpecialOverlayRenderMatrix(
    rotation: number,
    rotationVariant: number,
    variant: string,
    entity: Entity
  ): number[] {
    return generateMatrixRotations([1, 1, 1, 1, 1, 1, 0, 1, 0])[rotation]
  }

  getDimensions(variant: string): Vector {
    return new Vector(1, 1)
  }

  getRenderPins(): boolean {
    return false
  }

  getIsUnlocked() {
    return true
  }
}

@RegisterComponent()
class CompactSignalReceiverComponent extends Component {}
