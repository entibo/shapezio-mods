import { globalConfig } from "shapez/core/config"
import { DrawParameters } from "shapez/core/draw_parameters"
import { Vector } from "shapez/core/vector"
import { BaseItem } from "shapez/game/base_item"
import { ColorItem } from "shapez/game/items/color_item"
import { ShapeItem } from "shapez/game/items/shape_item"
import { MapChunkView } from "shapez/game/map_chunk_view"
import { BeltSystem } from "shapez/game/systems/belt"
import { ItemAcceptorSystem } from "shapez/game/systems/item_acceptor"
import { ItemEjectorSystem } from "shapez/game/systems/item_ejector"
import { MOD_SIGNALS } from "shapez/mods/mod_signals"
import { GameRoot } from "shapez/savegame/savegame"
import { isCompactMachine, isCompactMachineOrRelay } from "../buildings"
import { override } from "../override"
import { getTileContent, rooted } from "../util"

export const enableItemAnimations = rooted(function* (root: GameRoot) {
  let currentlyDrawingBeltsOrAcceptorsOrEjectors = false

  yield class extends BeltSystem {
    drawBeltItems(parameters: DrawParameters): void {
      currentlyDrawingBeltsOrAcceptorsOrEjectors = true
      super.drawBeltItems(parameters)
      currentlyDrawingBeltsOrAcceptorsOrEjectors = false
    }
  }

  for (const klass of [ItemAcceptorSystem, ItemEjectorSystem])
    yield class extends klass {
      drawChunk(parameters: DrawParameters, chunk: MapChunkView): void {
        currentlyDrawingBeltsOrAcceptorsOrEjectors = true
        super.drawChunk(parameters, chunk)
        currentlyDrawingBeltsOrAcceptorsOrEjectors = false
      }
    }

  for (const klass of [ColorItem, ShapeItem])
    yield class extends klass {
      tryDrawItemEnteringOrExitingCompactMachine(
        worldX: number,
        worldY: number,
        parameters: DrawParameters,
        diameter = (globalConfig as any).defaultItemDiameter
      ): true | void {
        if (!currentlyDrawingBeltsOrAcceptorsOrEjectors) return

        const world = new Vector(worldX, worldY)
        const entity = getTileContent(root, world.toTileSpace(), "regular")

        if (!entity || !isCompactMachineOrRelay(entity)) return

        const delta = world
          .divideScalar(globalConfig.tileSize)
          .modScalar(1)
          .multiplyScalar(2)
          .subScalar(1)

        // 0 -> 1 (tile center -> tile border)
        const g = Math.max(Math.abs(delta.x), Math.abs(delta.y)) ** 3
        const opacity = g
        const scale = isCompactMachine(entity)
          ? // 1/4 -> 1
            g * (1 - 0.25) + 0.25
          : // 1 -> 1.25
            1 + (1 - g) ** 8 * 1.25

        const previousAlpha = parameters.context.globalAlpha
        parameters.context.globalAlpha = opacity
        super.drawItemCenteredClipped(
          worldX,
          worldY,
          parameters,
          diameter * scale
        )
        parameters.context.globalAlpha = previousAlpha
        return true
      }

      drawItemCenteredClipped(...args: Params): void {
        if (!this.tryDrawItemEnteringOrExitingCompactMachine(...args))
          super.drawItemCenteredClipped(...args)
      }
    }
})

type Params = Parameters<BaseItem["drawItemCenteredClipped"]>
