import { arrayAllDirections, Vector } from "shapez/core/vector"
import { WirePinSlot } from "shapez/game/components/wired_pins"
import { Entity } from "shapez/game/entity"
import { WireNetwork, WireSystem } from "shapez/game/systems/wire"
import { GameRoot } from "shapez/savegame/savegame"
import { isCompactMachine, isCompactSignalReceiver } from "../buildings"
import ZoneManager from "./ZoneManager"
import { getTileContent, rooted } from "../util"

export const enableWires = rooted(function* (
  root: GameRoot,
  zoneManager: ZoneManager
) {
  yield class extends WireSystem {
    // Recompute networks when a compact machine is added/destroyed
    isEntityRelevantForWires(entity: Entity): any {
      return isCompactMachine(entity) || super.isEntityRelevantForWires(entity)
    }

    findSurroundingWireTargets(tile: Vector) {
      const result = super.findSurroundingWireTargets.apply(
        this,
        arguments as any
      ) as { entity: Entity; slot?: WirePinSlot }[]

      if (!getReceiverAt(root, tile)) return result

      // Tile has a signal receiver

      result.push(...this.wireTargetsOutsideCompactMachine(tile))
      result.push(...this.wireTargetsInsideCompactMachine(tile))
      return result
    }

    // The two following methods should be symmetrical

    *wireTargetsOutsideCompactMachine(tile: Vector) {
      if (getMachineAt(root, tile)) return

      // Receiver is not on top of a compact machine: signal goes outside

      const cm = zoneManager.getZoneAtTile(tile)?.getCompactMachineAtTile(tile)
      if (!cm) return

      // Receiver is inside a compact machine

      const rcv = getReceiverAt(root, cm.static.origin)
      if (!rcv) return

      // There is a receiver on top of that compact machine

      yield { entity: rcv, slot: rcv.components.WiredPins.slots[0] }
    }

    *wireTargetsInsideCompactMachine(tile: Vector) {
      const cm = getMachineAt(root, tile)
      if (!cm || !cm.compact.zone) return

      // Receiver is on top of a compact machine: signal goes inside

      // Scan the compact machine's chunk for receivers
      for (const [x, y] of cm.compact.zone.getChunkBounds(cm.compact.offset)) {
        const insideTile = new Vector(x, y)
        const rcv = getReceiverAt(root, insideTile)
        if (!rcv) continue

        // There is a receiver inside the compact machine

        if (getMachineAt(root, insideTile)) continue

        // That receiver is not on top of another compact machine

        yield { entity: rcv, slot: rcv.components.WiredPins.slots[0] }
      }
    }
  }
})

function getReceiverAt(root: GameRoot, tile: Vector) {
  const entity = getTileContent(root, tile, "wires")
  if (!entity || !isCompactSignalReceiver(entity)) return
  return entity
}
function getMachineAt(root: GameRoot, tile: Vector) {
  const entity = getTileContent(root, tile, "regular")
  if (!entity || !isCompactMachine(entity)) return
  return entity
}
