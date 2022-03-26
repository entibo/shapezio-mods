import { globalConfig } from "shapez/core/config"
import { AtlasSprite } from "shapez/core/draw_utils"
import { Rectangle } from "shapez/core/rectangle"
import { Vector } from "shapez/core/vector"
import { Blueprint } from "shapez/game/blueprint"
import { Entity } from "shapez/game/entity"
import { GameSystem } from "shapez/game/game_system"
import { KEYMAPPINGS } from "shapez/game/key_action_mapper"
import { defaultBuildingVariant } from "shapez/game/meta_building"
import { GameRoot } from "shapez/savegame/savegame"
import {
  CompactMachine,
  isCompactMachine,
  ModMetaCompactMachineBuilding,
} from "../buildings"
import { storeContents } from "./compact_utils"
import { RegisterGameSystem } from "../decorators"
import { override } from "../override"
import { getCompactSprite } from "../rendering/compact_sprite"
import { getMetaBuilding, makeEmptyChunkSizedArray } from "../util"

@override()
class _Blueprint extends Blueprint {
  static fromUids(root: GameRoot, uids: number[]): Blueprint {
    const blueprint = super.fromUids(root, uids)
    for (const [i, entity] of blueprint.entities.entries()) {
      if (!isCompactMachine(entity)) continue
      storeContents(root, entity)
      entity.static.rotation = 0
      entity.static.originalRotation = 0
      entity.compact.contents!.rotation = 0
      setBlueprintSprite(root, entity, i.toString())
    }
    return blueprint
  }
}

function setBlueprintSprite(
  root: GameRoot,
  cm: CompactMachine,
  subKey: string
) {
  if (!cm.compact.contents) return

  const contents = makeEmptyChunkSizedArray()
  const wireContents = makeEmptyChunkSizedArray()
  for (const entity of cm.compact.contents.entities)
    for (const [x, y] of entity.static.getTileSpaceBounds())
      if (
        x >= 0 &&
        y >= 0 &&
        x <= globalConfig.mapChunkSize &&
        y <= globalConfig.mapChunkSize
      ) {
        if(entity.layer === "regular") contents[x][y] = entity
        else wireContents[x][y] = entity
      }

  cm.static.getBlueprintSprite = () => {
    const compactSprite = getCompactSprite({
      root,
      contents,
      wireContents,
      key: "compact_blueprint@" + root.currentLayer,
      subKey,
    })
    return <AtlasSprite>{
      drawCached: compactSprite.draw,
    }
  }
}

@RegisterGameSystem()
class BlueprintCompactModifierSystem extends GameSystem {
  lastValue = false
  update() {
    const value = this.root.keyMapper.getBinding(
      KEYMAPPINGS.placementModifiers.placeInverse // ALT
    ).pressed
    if (value !== this.lastValue) {
      this.modifierChanged(value)
      this.lastValue = value
    }
  }
  modifierChanged(pressed: boolean) {
    const blueprintPlacer = this.root.hud.parts.blueprintPlacer
    const currentBlueprint = blueprintPlacer.currentBlueprint.get()
    if (!currentBlueprint) return

    if (pressed) {
      const cms = compactEntities(this.root, currentBlueprint.entities)
      for (const [i, cm] of cms.entries())
        setBlueprintSprite(this.root, cm, "modifier:" + i)
      blueprintPlacer.currentBlueprint.setSilent(new Blueprint(cms))
      return
    }

    // Modifier was released, reset
    blueprintPlacer.currentBlueprint.setSilent(
      blueprintPlacer.lastBlueprintUsed
    )
  }
}

/**
 * Packs `entities` into compact machines
 */
function compactEntities(root: GameRoot, entities: Entity[]): CompactMachine[] {
  // Get the bounding rect of the entities
  let bounds = new Rectangle(0, 0, 0, 0)
  for (const entity of entities) {
    const staticComp = entity.static
    bounds = staticComp.getTileSpaceBounds().getUnion(bounds)
  }
  // Prepare a grid 4 times smaller
  const grid: Set<Entity>[][] = []
  for (let x = bounds.x; x < bounds.x + bounds.w; x += 4) {
    const col: Set<Entity>[] = []
    grid.push(col)
    for (let y = bounds.y; y < bounds.y + bounds.h; y += 4) {
      col.push(new Set<Entity>())
    }
  }
  // Add each entity to every grid cell it intersects
  for (const entity of entities) {
    let rect = entity.static.getTileSpaceBounds()
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      for (let y = rect.y; y < rect.y + rect.h; y++) {
        const i = Math.floor((x - bounds.x) / 4)
        const j = Math.floor((y - bounds.y) / 4)
        grid[i][j].add(entity)
      }
    }
  }
  // For each non-empty grid cell, make a compact machine
  // and store a copy of the entities into it
  const compactMachines: CompactMachine[] = []
  for (let i = 0; i < grid.length; i++) {
    for (let j = 0; j < grid[i].length; j++) {
      if (!grid[i][j].size) continue
      const origin = new Vector(
        Math.ceil(i - grid.length / 2),
        Math.ceil(j - grid[i].length / 2)
      )
      const gridOffset = new Vector(i, j)
        .multiplyScalar(4)
        .addScalars(bounds.x, bounds.y)
      const cm = getMetaBuilding(ModMetaCompactMachineBuilding).createEntity({
        root,
        origin,
        rotation: 0,
        rotationVariant: 0,
        originalRotation: 0,
        variant: defaultBuildingVariant,
      }) as CompactMachine
      cm.compact.contents = {
        entities: [...grid[i][j]].map((entity) => {
          const clone = entity.clone()
          clone.static.origin.subInplace(gridOffset)
          return clone
        }),
        rotation: 0,
      }
      compactMachines.push(cm)
    }
  }
  return compactMachines
}
