import { Vector } from "shapez/core/vector"
import { MapChunk } from "shapez/game/map_chunk"
import { GameRoot } from "shapez/game/root"
import { rooted } from "../util"
import Zone from "./Zone"
import ZoneManager from "./ZoneManager"

export const enableResourceOverride = rooted(function* (
  root: GameRoot,
  zoneManager: ZoneManager
) {
  yield class extends MapChunk {
    // Miners use this method to determine what resources to mine
    getLowerLayerFromWorldCoords(x: number, y: number) {
      const tile = new Vector(x, y)
      const cm = zoneManager.getZoneAtTile(tile)?.getCompactMachineAtTile(tile)
      if (!cm) return super.getLowerLayerFromWorldCoords(x, y)
      const outsideTile = cm.static.origin
      return this.root.map.getLowerLayerContentXY(outsideTile.x, outsideTile.y)
    }

    // Disable all resources within compact zones,
    // so they won't be rendered
    generateLowerLayer() {
      if (Zone.isInGlobalZone(new Vector(this.tileX, this.tileY))) return
      super.generateLowerLayer()
    }
  }
})
