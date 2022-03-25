import { Vector } from "shapez/core/vector"
import { Entity } from "shapez/game/entity"
import { GameLogic } from "shapez/game/logic"
import { override } from "../override"
import { isCompactMachine } from "./CompactMachine"
import { isCompactMachineRelay } from "./CompactMachineRelay"

export * from "./CompactMachine"
export * from "./CompactMachineRelay"

export function isCompactMachineOrRelay(entity: Entity) {
  return isCompactMachine(entity) || isCompactMachineRelay(entity)
}

// Without this, belts connect to them aggressively
@override()
class _GameLogic extends GameLogic {
  getEjectorsAndAcceptorsAtTile(tile: Vector) {
    const { acceptors, ejectors } = super.getEjectorsAndAcceptorsAtTile(tile)
    return {
      acceptors: acceptors.filter(
        ({ entity }) => !isCompactMachineOrRelay(entity)
      ),
      ejectors: ejectors.filter(
        ({ entity }) => !isCompactMachineOrRelay(entity)
      ),
    }
  }
}
