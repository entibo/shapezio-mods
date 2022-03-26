import { arrayAllDirections, Vector } from "shapez/core/vector"
import { WirePinSlot } from "shapez/game/components/wired_pins"
import { Entity } from "shapez/game/entity"
import { WireNetwork, WireSystem } from "shapez/game/systems/wire"
import { GameRoot } from "shapez/savegame/savegame"
import { isCompactMachine, isCompactSignalReceiver } from "./buildings"
import ZoneManager from "./logic/ZoneManager"
import { getTileContent, rooted } from "./util"

export const enableWires = rooted(function* (
  root: GameRoot,
  zoneManager: ZoneManager
) {
  yield class extends WireSystem {
    isEntityRelevantForWires(entity: Entity): any {
      return isCompactMachine(entity) || super.isEntityRelevantForWires(entity)
    }
    recomputeWiresNetwork() {
      super.recomputeWiresNetwork()
    }
    findSurroundingWireTargets(
      initialTile: Vector,
      directions: string[],
      network: WireNetwork,
      variantMask?: string
    ) {
      const result = super.findSurroundingWireTargets(
        initialTile,
        directions,
        network,
        variantMask
      ) as { entity: Entity; slot?: WirePinSlot }[]

      const initialEntity = getTileContent(root, initialTile, "wires")
      if (!initialEntity) return result

      // Wire on top of compact machine ?
      if (initialEntity.components.Wire) {
        const cm = getTileContent(root, initialTile, "regular")
        if (!cm || !isCompactMachine(cm) || !cm.compact.zone) return result

        // Look for a receivers inside the compact machine
        for (const [x, y] of cm.compact.zone.getChunkBounds(
          cm.compact.offset
        )) {
          const tile = new Vector(x, y)
          const entity = getTileContent(root, tile, "wires")
          if (!entity) continue
          if (!isCompactSignalReceiver(entity)) continue
          const slot = entity.components.WiredPins.slots[0]
          const newSearchDirection = entity.static.localDirectionToWorld(
            slot.direction
          )
          result.push(
            ...super.findSurroundingWireTargets(
              tile,
              [newSearchDirection],
              network,
              variantMask
            )
          )
        }
      }
      // Inside compact machine under wire ?
      else {
        const zone = zoneManager.getZoneAtTile(initialTile)
        if (zone) {
          const cm = zone.getCompactMachineAtTile(initialTile)
          if (cm) {
            result.push(
              ...super.findSurroundingWireTargets(
                cm.static.origin,
                arrayAllDirections,
                network,
                variantMask
              )
            )
          }
        }
      }

      return result
    }
  }
})
