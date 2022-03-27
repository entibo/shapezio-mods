import { Loader } from "shapez/core/loader"
import { generateMatrixRotations } from "shapez/core/utils"
import { enumDirection, Vector } from "shapez/core/vector"
import { Component } from "shapez/game/component"
import {
  enumPinSlotType,
  WiredPinsComponent,
} from "shapez/game/components/wired_pins"
import { Entity } from "shapez/game/entity"
import { defaultBuildingVariant, MetaBuilding } from "shapez/game/meta_building"
import { THEME } from "shapez/game/theme"
import toolbarIcon from "../../res/sprites/compact-signal-toolbar.png"
import tutorialImage from "../../res/ui/building_tutorials/compact-signal-receiver.png"
import {
  AddNewBuildingToToolbar,
  RegisterComponent,
  RegisterNewBuilding,
} from "../decorators"
import { getComponent } from "../util"

export function isCompactSignalReceiver<T extends Entity>(
  entity: T
): entity is T {
  return !!getComponent(entity, CompactSignalReceiverComponent)
}

//-----------------------------------------------------------------------------

@RegisterNewBuilding({ buildingIconBase64: toolbarIcon })
@AddNewBuildingToToolbar({ toolbar: "wires", location: "secondary" })
export class MetaCompactSignalReceiverBuilding extends MetaBuilding {
  static getAllVariantCombinations() {
    return [
      {
        name: "Transceiver",
        description: "Connects the inside and the outside of a compact machine to a wire network.",
        variant: defaultBuildingVariant,

        // regularImageBase64: multiPng,
        // blueprintImageBase64: multiPng,
        tutorialImageBase64: tutorialImage,
      },
    ]
  }

  getLayer(): Layer {
    return "wires"
  }

  setupEntityComponents(entity: Entity) {
    entity.addComponent(
      new WiredPinsComponent({
        slots: [
          {
            pos: new Vector(0, 0),
            direction: enumDirection.bottom,
            type: enumPinSlotType.logicalAcceptor,
          },
        ],
      })
    )
    entity.addComponent(new CompactSignalReceiverComponent())
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
    return Loader.getSprite("sprites/buildings/compact-signal-receiver.png")
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
