import { Signal, STOP_PROPAGATION } from "shapez/core/signal"
import { Vector } from "shapez/core/vector"
import { enumMouseButton } from "shapez/game/camera"
import { Entity } from "shapez/game/entity"
import { GameSystem } from "shapez/game/game_system"
import { GameRoot } from "shapez/savegame/savegame"
import { RegisterGameSystem } from "./decorators"
import { GameSignal } from "./signals"
import { getTileContent } from "./util"

const DOUBLE_CLICK_THRESHOLD = 1000

export const doubleClickTileSignal = new GameSignal<[Vector]>()
export const doubleClickEntitySignal = new GameSignal<[Entity]>()

@RegisterGameSystem()
export class DoubleClickDetector extends GameSystem {
  lastLeftClickTime = 0
  constructor(root: GameRoot) {
    super(root)

    root.camera.downPreHandler.add((pos: Vector, btn: string) => {
      if (btn !== enumMouseButton.left) return
      const now = performance.now()
      if (now - this.lastLeftClickTime > DOUBLE_CLICK_THRESHOLD) {
        this.lastLeftClickTime = now
        return
      }
      const tile = root.camera.screenToWorld(pos).toTileSpace()
      if ((doubleClickEntitySignal as Signal).receivers.length) {
        const entity = getTileContent(root, tile, root.currentLayer as Layer)
        if (entity)
          if (doubleClickEntitySignal.dispatch(entity) === STOP_PROPAGATION)
            return STOP_PROPAGATION
      }
      return doubleClickTileSignal.dispatch(tile)
    })

    root.camera.movePreHandler.add(() => {
      this.lastLeftClickTime = 0
    })
  }
}
