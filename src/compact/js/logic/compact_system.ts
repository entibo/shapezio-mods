import { globalConfig } from "shapez/core/config"
import { DrawParameters } from "shapez/core/draw_parameters"
import { STOP_PROPAGATION } from "shapez/core/signal"
import { Vector } from "shapez/core/vector"
import { Entity } from "shapez/game/entity"
import { GameSystemWithFilter } from "shapez/game/game_system_with_filter"
import { MapChunkView } from "shapez/game/map_chunk_view"
import { GameRoot } from "shapez/game/root"
import "./blueprints"
import {
  CompactMachine,
  CompactMachineComponent,
  isCompactMachine,
} from "../buildings"
import CameraManager from "./CameraManager"
import {
  createCompactMachineRelay,
  getAllConnectedCompactMachines,
  getCompactMachineNeighbors,
  getCompactMachineRelay,
  getOrCreateCompactMachineRelay,
  linkCompactMachineAndRelay,
  storeContents,
  tryRestoreContents,
} from "./compact_utils"
import {
  DrawHook,
  OnRootSignal,
  OnSignal,
  RegisterGameSystem,
  SignalReceiver,
} from "../decorators"
import { getCompactSprite } from "../rendering/compact_sprite"
import "../rendering/item_animation"
import { enableItemAnimations } from "../rendering/item_animation"
import { drawZoneBackground } from "../rendering/zone_background"
import { enableResourceOverride } from "./resources"
import { rootSignals } from "../signals"
import {
  clearArea,
  deleteEntity,
  getTileContent,
  invertedDirection,
  neighborOffsets,
} from "../util"
import Zone from "./Zone"
import ZoneManager from "./ZoneManager"

@RegisterGameSystem({ updateBefore: "itemProcessor" })
export class CompactMachineSystem extends SignalReceiver(GameSystemWithFilter) {
  allEntities!: CompactMachine[]

  cameraManager: CameraManager
  zoneManager: ZoneManager

  constructor(root: GameRoot) {
    super(root, [CompactMachineComponent])

    this.zoneManager = new ZoneManager()
    this.cameraManager = new CameraManager(root.camera, this.zoneManager)

    enableResourceOverride(this.root, this.zoneManager)
    enableItemAnimations(this.root)
  }

  update() {
    this.cameraManager.update()
  }

  @OnSignal(rootSignals.prePlacementCheck)
  prePlacementCheck(entity: Entity, tileOffset?: Vector) {
    const tile = tileOffset
      ? entity.static.origin.add(tileOffset)
      : entity.static.origin
    const zone = this.zoneManager.getZoneAtTile(tile)
    if (!zone) return

    // The relay buildings already prevent placing
    // across the machine boundary.

    for (const cm of zone.compactMachines) {
      if (zone.getChunkBounds(cm.compact.offset).containsPoint(tile.x, tile.y))
        return
    }

    // Inside zone, but outside compact chunks: not allowed
    return STOP_PROPAGATION
  }

  @DrawHook({ oncePerFrame: true })
  backgroundLayerBefore(parameters: DrawParameters, _chunk: MapChunkView) {
    const zone = this.cameraManager.getCurrentZone()
    if (zone) drawZoneBackground(this.root, parameters, zone)
  }

  @DrawHook()
  backgroundLayerAfter(parameters: DrawParameters, chunk: MapChunkView) {
    for (const cm of chunk.containedEntitiesByLayer.regular) {
      if (!isCompactMachine(cm) || !cm.compact.zone) continue

      const world = cm.static.origin.toWorldSpace()

      const targetOrigin = cm.compact.zone.getChunkOrigin(cm.compact.offset)
      const targetChunk = this.root.map.getOrCreateChunkAtTile(
        targetOrigin.x,
        targetOrigin.y
      )

      getCompactSprite({
        root: this.root,
        key: "compact@" + this.root.currentLayer,
        subKey: cm.uid + "@" + targetChunk.renderIteration,
        contents: targetChunk.contents,
        localTileOffset: targetOrigin.modScalar(globalConfig.mapChunkSize),
      }).draw(parameters, world.x, world.y)
    }
  }

  @OnRootSignal()
  gameRestored() {
    for (const cm of this.allEntities) {
      for (const [direction] of neighborOffsets) {
        const cmr = getCompactMachineRelay(
          this.root,
          cm.compact.zone!,
          cm.compact.offset.add(neighborOffsets[direction])
        )
        if (!cmr) continue
        linkCompactMachineAndRelay(cm, cmr, direction)
      }
    }
  }

  @OnRootSignal()
  entityAdded(cm: Entity) {
    if (!isCompactMachine(cm)) return

    // Deserialized from save: register and exit
    if (cm.compact.zoneId !== null) {
      cm.compact.zone = this.zoneManager.getOrCreateZone(cm.compact.zoneId)
      cm.compact.zone.compactMachines.add(cm)
      return
    }

    // Find a neighbor to attach to, bridge other neighbors
    let target
    for (const next of getCompactMachineNeighbors(this.root, cm)) {
      // Pick the first neighbor as the target
      if (!target) {
        target = next
        continue
      }
      // Merge this other neighbor's zone with the target zone
      if (next.cm.compact.zoneId !== target.cm.compact.zone!.zoneId) {
        this.transferContents(
          next.cm.compact.zone!.compactMachines,
          target.cm.compact.zone!,
          target.cm.compact.offset
            .sub(target.delta)
            .add(next.delta)
            .sub(next.cm.compact.offset)
        )
      }
    }

    // Add the new machine into the (newly unified) target zone
    if (target) {
      this.addToZone(
        cm,
        target.cm.compact.zone!,
        target.cm.compact.offset.sub(target.delta)
      )
    }
    // No neighbors, create new zone
    else {
      this.addToZone(cm, this.zoneManager.findAvailableZone())
    }
  }

  @OnRootSignal()
  entityDestroyed(cm: Entity) {
    if (!isCompactMachine(cm)) return
    if (!cm.compact.zone) return

    const zoneId = cm.compact.zoneId
    this.removeFromZone(cm)

    // Check if we made orphans
    for (const next of getCompactMachineNeighbors(this.root, cm)) {
      if (next.cm.compact.zoneId !== zoneId) continue
      this.transferContents(
        getAllConnectedCompactMachines(this.root, next.cm),
        this.zoneManager.findAvailableZone(),
        next.cm.compact.offset.multiplyScalar(-1)
      )
    }
  }

  addToZone(cm: CompactMachine, zone: Zone, offset = new Vector(0, 0)) {
    // Register
    cm.compact.zoneId = zone.zoneId
    cm.compact.zone = zone
    cm.compact.offset = offset
    zone.compactMachines.add(cm)

    // Clear the chunk itself, it might contain a relay
    clearArea(this.root, zone.getChunkBounds(offset), true)

    // Create or update relay entities in adjacent chunks
    for (const [dir, delta] of neighborOffsets) {
      const neigh = getTileContent(
        this.root,
        cm.static.origin.add(delta),
        "regular"
      )
      if (neigh && isCompactMachine(neigh)) continue
      // The chunk at (dir) is empty
      const cmr = getOrCreateCompactMachineRelay(
        this.root,
        zone,
        offset.add(delta)
      )
      linkCompactMachineAndRelay(cm, cmr, dir)
    }

    tryRestoreContents(this.root, cm)
  }

  removeFromZone(cm: CompactMachine) {
    if (!cm.compact.zone) return
    const zone = cm.compact.zone

    // Unregister
    cm.compact.zoneId = null
    cm.compact.zone = null
    zone.compactMachines.delete(cm)

    // Clear the chunk itself
    clearArea(this.root, zone.getChunkBounds(cm.compact.offset), true)

    // Delete or update relay entities in adjacent chunks
    for (const [direction, v] of neighborOffsets) {
      const cmr = getCompactMachineRelay(
        this.root,
        zone,
        cm.compact.offset.add(v)
      )
      if (!cmr) continue
      // Remove self reference
      cmr.relay.clearTarget(invertedDirection[direction])
      if (!cmr.relay.hasAnyTarget()) {
        deleteEntity(this.root, cmr, true)
      }
    }

    if (!zone.compactMachines.size) {
      this.zoneManager.freeZone(zone)
      return
    }

    // Replace self chunk with a relay (if necessary)

    let cmr
    for (const next of getCompactMachineNeighbors(this.root, cm)) {
      // This happens in the process of relocating
      if (next.cm.compact.zoneId !== zone.zoneId) continue

      if (!cmr)
        cmr = createCompactMachineRelay(
          this.root,
          zone.getChunkOrigin(cm.compact.offset)
        )

      linkCompactMachineAndRelay(
        next.cm,
        cmr,
        invertedDirection[next.direction]
      )
    }
  }

  // It's important to do this as a group because some
  // buildings might lay across multiple machine chunks
  transferContents(
    compactMachines: Iterable<CompactMachine>,
    targetZone: Zone,
    relOffset: Vector
  ) {
    for (const cm of compactMachines) storeContents(this.root, cm)
    for (const cm of compactMachines) {
      const targetOffset = cm.compact.offset.add(relOffset)
      this.removeFromZone(cm)
      this.addToZone(cm, targetZone, targetOffset)
    }
  }
}
