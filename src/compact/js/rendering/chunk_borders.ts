import { Vector } from "shapez/core/vector"
import { MapChunkView } from "shapez/game/map_chunk_view"
import { MapResourcesSystem } from "shapez/game/systems/map_resources"
import { GameRoot } from "shapez/savegame/savegame"
import Zone from "../logic/Zone"
import { rooted } from "../util"

export const enableChunkBordersOverride = rooted(function* (root: GameRoot) {
  yield class extends MapResourcesSystem {
    generateChunkBackground(chunk: MapChunkView) {
      const settings = root.app.settings.getAllSettings()
      const displayChunkBorders = settings.displayChunkBorders
      if (Zone.isInGlobalZone(new Vector(chunk.tileX, chunk.tileY)))
        settings.displayChunkBorders = false
      super.generateChunkBackground.apply(this, arguments as any)
      settings.displayChunkBorders = displayChunkBorders
    }
  }
})
