import { globalConfig } from "shapez/core/config"
import { STOP_PROPAGATION } from "shapez/core/signal"
import { Vector } from "shapez/core/vector"
import { Camera } from "shapez/game/camera"
import { Entity } from "shapez/game/entity"
import {
  CompactMachine,
  CompactMachineComponent,
  isCompactMachine,
} from "../buildings"
import { OnSignal, SignalReceiver } from "../decorators"
import { doubleClickEntitySignal } from "../double_click_detector"
import { getComponent } from "../util"
import Zone from "./Zone"
import ZoneManager from "./ZoneManager"

@SignalReceiver
export default class CameraManager {
  currentZone: Zone | null = null
  /**
   * Keeps track of the successive compact machines
   * that were entered, so we know where to exit
   */
  compactStack: { cm: CompactMachine; zoomLevel: number }[] = []

  constructor(public camera: Camera, public zoneManager: ZoneManager) {}

  getTile() {
    return (this.camera.desiredCenter || this.camera.center).toTileSpace()
  }

  getCurrentZone() {
    return this.currentZone
  }

  @OnSignal(doubleClickEntitySignal)
  doubleClickEntity(cm: Entity) {
    if (!isCompactMachine(cm)) return
    if (this.camera.getIsMapOverlayActive()) return
    this.enterCompactMachine(cm)
    return STOP_PROPAGATION
  }

  update() {
    const zone = this.zoneManager.getZoneAtTile(this.getTile())
    if (this.currentZone) {
      if (this.camera.getIsMapOverlayActive()) {
        this.exitCompactMachine()
        return
      }
      // The camera has left currentZone: player used a marker or went back to hub
      if (zone !== this.currentZone) {
        // Take the camera outside ?
        if (!zone) {
          const firstEntered = this.compactStack[0]
          if (firstEntered) {
            this.instantlyMoveCameraTo(
              firstEntered.cm.static.origin.toWorldSpaceCenterOfTile()
            )
            this.camera.zoomLevel = firstEntered.zoomLevel
          }
        }
        this.currentZone = null
        this.compactStack = []
      } else return
    }

    if (!zone || this.currentZone) return

    // The camera is in a zone: player used a marker or reloaded the game
    // Set currentZone from zone

    if (this.camera.desiredCenter) {
      this.instantlyMoveCameraTo(this.camera.desiredCenter)
    }
    this.currentZone = zone
    this.compactStack = []
    // Set machine history
    for (let curZone: Zone | null = zone; curZone; ) {
      // Find the center machine of this zone
      const cm = [...curZone.compactMachines].find((cm) => {
        return cm.compact.offset.x === 0 && cm.compact.offset.y === 0
      })
      if (!cm) break
      this.compactStack.unshift({
        cm: cm,
        zoomLevel: this.camera.zoomLevel,
      })
      // If the machine is inside another machine, loop
      curZone = this.zoneManager.getZoneAtTile(cm.static.origin)
    }
  }

  enterCompactMachine(cm: CompactMachine) {
    const zone = cm.compact.zone
    if (zone === null) return
    // console.log("enterCompactMachine", compactMachine, zone)

    const camera = this.camera
    const zoomLevel = camera.zoomLevel
    this.compactStack.push({ cm: cm, zoomLevel })
    this.currentZone = zone

    camera.clearAnimations()
    this.instantlyMoveCameraTo(
      zone.getChunkOrigin(cm.compact.offset).addScalar(2).toWorldSpace()
    )
    camera.zoomLevel = Math.max(
      camera.getMaximumZoom() / 4,
      globalConfig.mapChunkOverviewMinZoom
    )
    camera.setDesiredZoom(zoomLevel)
  }

  exitCompactMachine() {
    const lastEntered = this.compactStack.pop()
    if (!lastEntered) return
    const { cm, zoomLevel } = lastEntered

    if (this.compactStack.length) {
      this.currentZone = getComponent(
        this.compactStack[this.compactStack.length - 1].cm,
        CompactMachineComponent
      ).zone!
    } else {
      this.currentZone = null
    }

    this.camera.clearAnimations()
    const offset = this.camera.center
      .sub(
        cm.compact
          .zone!.getChunkOrigin(cm.compact.offset)
          .addScalar(2)
          .toWorldSpace()
      )
      .divideScalar(4)
    this.instantlyMoveCameraTo(
      cm.static.origin.toWorldSpaceCenterOfTile().add(offset)
    )
    this.camera.setDesiredCenter(this.camera.center)
    this.camera.zoomLevel = this.camera.getMaximumZoom()
    this.camera.setDesiredZoom(zoomLevel)
  }

  instantlyMoveCameraTo(worldPos: Vector) {
    this.camera.center = worldPos
    // This prevents the game from trying to place
    // buildings on the way
    this.camera.desiredCenter = worldPos
  }
}
