import { safeModulo } from "shapez/core/utils"
import { Vector } from "shapez/core/vector"
import { Entity } from "shapez/game/entity"
import { defaultBuildingVariant } from "shapez/game/meta_building"
import { GameRoot } from "shapez/savegame/savegame"
import {
  CompactMachine,
  isCompactMachine,
  ModMetaCompactMachineRelayBuilding,
  CompactMachineRelay,
  isCompactMachineRelay,
} from "../buildings"
import {
  getNeighbors,
  getMetaBuilding,
  getTileContent,
  clearArea,
  Direction,
  invertedDirection,
} from "../util"
import Zone from "./Zone"

/** Including start */
export function getAllConnectedCompactMachines(
  root: GameRoot,
  start: CompactMachine
) {
  const seen = new Set<CompactMachine>()
  const stack = [start]
  while (stack.length) {
    const cm = stack.pop()!
    seen.add(cm)
    for (const next of getCompactMachineNeighbors(root, cm)) {
      if (seen.has(next.cm)) continue
      stack.push(next.cm)
    }
  }
  return seen
}

export function* getCompactMachineNeighbors(root: GameRoot, entity: Entity) {
  for (const next of getNeighbors(root, entity)) {
    if (!isCompactMachine(next.entity)) continue
    yield { ...next, cm: next.entity }
  }
}

/** Assumes the area is clear */
export function createCompactMachineRelay(root: GameRoot, origin: Vector) {
  const cmr = getMetaBuilding(ModMetaCompactMachineRelayBuilding).createEntity({
    root,
    origin,
    rotation: 0,
    rotationVariant: 0,
    originalRotation: 0,
    variant: defaultBuildingVariant,
  }) as CompactMachineRelay
  root.map.placeStaticEntity(cmr)
  root.entityMgr.registerEntity(cmr)
  return cmr
}

export function getCompactMachineRelay(
  root: GameRoot,
  zone: Zone,
  offset: Vector
) {
  const chunkOrigin = zone.getChunkOrigin(offset)
  let entity = getTileContent(root, chunkOrigin, "regular")
  if (!entity || !isCompactMachineRelay(entity)) return null
  return entity
}

export function getOrCreateCompactMachineRelay(
  root: GameRoot,
  zone: Zone,
  offset: Vector
) {
  const chunkOrigin = zone.getChunkOrigin(offset)
  let entity = getTileContent(root, chunkOrigin, "regular")
  if (entity && !isCompactMachineRelay(entity)) {
    clearArea(root, zone.getChunkBounds(offset), true)
    entity = null
  }
  return entity || createCompactMachineRelay(root, chunkOrigin)
}

export function storeContents(root: GameRoot, cm: CompactMachine) {
  if (!cm.compact.zone) return
  const seenEntities = new Map<Entity, Entity>()
  const origin = cm.compact.zone.getChunkOrigin(cm.compact.offset)
  for (let x = origin.x; x < origin.x + 4; x++) {
    for (let y = origin.y; y < origin.y + 4; y++) {
      for (const entity of root.map.getLayersContentsMultipleXY(x, y)) {
        if (isCompactMachine(entity)) storeContents(root, entity)
        const clone = entity.clone()
        clone.static.origin.subInplace(origin)
        seenEntities.set(entity, clone)
      }
    }
  }
  cm.compact.contents = {
    entities: [...seenEntities.values()],
    rotation: cm.static.rotation,
  }
}

export function tryRestoreContents(root: GameRoot, cm: CompactMachine) {
  if (cm.compact.contents === null) return

  const origin = cm.compact.zone!.getChunkOrigin(cm.compact.offset)

  // contents.rotation was set to static.rotation when the contents were stored
  // static.rotation might have been updated by the blueprint placer
  const a = safeModulo(cm.static.rotation - cm.compact.contents.rotation, 360)

  for (const entity of cm.compact.contents.entities) {
    const clone = entity.clone()

    if (a) {
      clone.static.rotation = (clone.static.rotation + a) % 360
      clone.static.originalRotation = (clone.static.originalRotation + a) % 360
      for (let i = a; i > 0; i -= 90) {
        const { x, y } = clone.static.origin
        clone.static.origin.x = 3 - y
        clone.static.origin.y = x
      }
    }

    clone.static.origin.addInplace(origin)

    if (!root.logic.checkCanPlaceEntity(clone, {})) continue
    root.logic.freeEntityAreaBeforeBuild(clone)
    root.map.placeStaticEntity(clone)
    root.entityMgr.registerEntity(clone)
  }

  cm.compact.contents = null
}

export function linkCompactMachineAndRelay(
  cm: CompactMachine,
  cmr: CompactMachineRelay,
  direction: Direction
) {
  cm.compact.targetRelays[direction] = cmr
  cmr.relay.targetCompactMachines[invertedDirection[direction]] = cm
}
