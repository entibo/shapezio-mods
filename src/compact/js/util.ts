import { globalConfig } from "shapez/core/config"
import { gMetaBuildingRegistry } from "shapez/core/global_registries"
import { Rectangle } from "shapez/core/rectangle"
import { SingletonFactory } from "shapez/core/singleton_factory"
import { make2DUndefinedArray, safeModulo } from "shapez/core/utils"
import { Vector } from "shapez/core/vector"
import { BaseItem } from "shapez/game/base_item"
import { Component } from "shapez/game/component"
import { Entity } from "shapez/game/entity"
import { MetaBuilding } from "shapez/game/meta_building"
import { GameRoot } from "shapez/game/root"
import { override } from "./override"

export function getComponent<T extends typeof Component>(
  entity: Entity,
  componentClass: T
): InstanceType<T> {
  //@ts-ignore
  return entity.components[componentClass.getId()]
}

export function getMetaBuilding<T extends { new (...args: any): MetaBuilding }>(
  klass: T
) {
  return (gMetaBuildingRegistry as SingletonFactory).findByClass(
    klass
  ) as InstanceType<T>
}

export type Direction = "left" | "right" | "top" | "bottom"

export function deleteEntity(
  root: GameRoot,
  entity: Entity,
  force: boolean
): boolean {
  if (entity.destroyed || entity.queuedForDestroy) {
    console.log("deleteEntity (!!):", entity.uid, "already destroyed")
    return true
  }
  if (force) {
    root.map.removeStaticEntity(entity)
    root.entityMgr.destroyEntity(entity)
    // Can't call this here, because we might already be going through the destroyList
    // root.entityMgr.processDestroyList()
    return true
  }
  return root.logic.tryDeleteBuilding(entity)
}

export function clearArea(
  root: GameRoot,
  area: Rectangle,
  force: boolean
): boolean {
  let allClear = true
  for (let x = area.x; x < area.x + area.w; ++x) {
    for (let y = area.y; y < area.y + area.h; ++y) {
      for (const entity of root.map.getLayersContentsMultipleXY(x, y)) {
        allClear = allClear && deleteEntity(root, entity, force)
      }
    }
  }
  return allClear
}

const directions: Direction[] = ["left", "top", "right", "bottom"]
export function rotatedDirection(dir: Direction, rot: number): Direction {
  const index = directions.indexOf(dir)
  return directions[safeModulo(index - Math.floor(rot / 90), 4)]
}
export const invertedDirection: Record<Direction, Direction> = {
  left: "right",
  right: "left",
  top: "bottom",
  bottom: "top",
}

export const neighborOffsets = {
  left: new Vector(-1, 0),
  right: new Vector(+1, 0),
  top: new Vector(0, -1),
  bottom: new Vector(0, +1),
  [Symbol.iterator]: function* (): Generator<readonly [Direction, Vector]> {
    yield ["left", this.left]
    yield ["right", this.right]
    yield ["top", this.top]
    yield ["bottom", this.bottom]
  },
}

export function getTileContent(root: GameRoot, tile: Vector): Entity[]
export function getTileContent(
  root: GameRoot,
  tile: Vector,
  layer: Layer
): Entity | null
export function getTileContent(
  root: GameRoot,
  tile: Vector,
  resources: "resources"
): BaseItem | null
export function getTileContent(
  root: GameRoot,
  tile: Vector,
  type?: Layer | "resources"
) {
  if (type === "resources")
    return root.map.getLowerLayerContentXY(tile.x, tile.y) || null
  else if (type) {
    return root.map.getTileContent(tile, type) || null
  }
  return root.map.getLayersContentsMultipleXY(tile.x, tile.y)
}

export function makeEmptyChunkSizedArray() {
  return make2DUndefinedArray(
    globalConfig.mapChunkSize,
    globalConfig.mapChunkSize
  ) as (Entity | null)[][]
}

export function* getNeighbors(root: GameRoot, entity: Entity) {
  for (const [direction, delta] of neighborOffsets) {
    const tile = entity.static.origin.add(delta)
    const neigh = root.map.getTileContent(tile, "regular")
    if (!neigh) continue
    yield {
      entity: neigh,
      delta,
      direction,
    }
  }
}

export function rooted<T extends any[]>(
  gen: (root: GameRoot, ...args: T) => Iterable<{ new (...args: any): any }>
) {
  return function (root: GameRoot, ...args: T) {
    for (const klass of gen(root, ...args))
      root.signals.aboutToDestruct.add(override(klass))
  }
}
