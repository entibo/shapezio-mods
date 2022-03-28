import { Vector } from "shapez/core/vector"
import { MapChunkView } from "shapez/game/map_chunk_view"
import { MapResourcesSystem } from "shapez/game/systems/map_resources"
import { GameRoot } from "shapez/savegame/savegame"
import Zone from "../logic/Zone"
import { rooted } from "../util"

export const enableChunkBackgroundOverride = rooted(function* (root: GameRoot) {
  yield class extends MapResourcesSystem {
    generateChunkBackground(chunk: MapChunkView) {
      if (Zone.isInGlobalZone(new Vector(chunk.tileX, chunk.tileY))) return
      super.generateChunkBackground.apply(this, arguments as any)
    }
  }
})
