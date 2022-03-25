import { Rectangle } from "shapez/core/rectangle"
import { Vector } from "shapez/core/vector"
import { CompactMachine } from "../buildings"

export default class Zone {
  static size = 4 * 129 // Can expand by 64 in each direction
  static numColumns = 256
  static globalOrigin = new Vector((-Zone.numColumns * Zone.size) / 2, 64000)

  static isInGlobalZone(tile: Vector) {
    return (
      tile.y >= Zone.globalOrigin.y &&
      tile.x >= Zone.globalOrigin.x &&
      tile.x < Zone.globalOrigin.x + Zone.numColumns * Zone.size
    )
  }
  static getZoneIdAtTile(tile: Vector): number | null {
    if (!this.isInGlobalZone(tile)) return null
    const zoneTile = tile
      .sub(Zone.globalOrigin)
      .divideScalarInplace(Zone.size)
      .floor()
    return zoneTile.y * Zone.numColumns + zoneTile.x
  }

  zoneId: number
  origin: Vector
  center: Vector
  bounds: Rectangle

  compactMachines = new Set<CompactMachine>()

  constructor(zoneId: number) {
    this.zoneId = zoneId
    this.origin = new Vector(
      zoneId % Zone.numColumns,
      Math.floor(zoneId / Zone.numColumns)
    )
      .multiplyScalar(Zone.size)
      .addInplace(Zone.globalOrigin)
    this.center = this.origin.addScalars(Zone.size / 2 - 2, Zone.size / 2 - 2)
    this.bounds = new Rectangle(
      this.origin.x,
      this.origin.y,
      Zone.size,
      Zone.size
    )
  }

  getChunkOrigin(offset: Vector) {
    return new Vector(
      this.center.x + offset.x * 4,
      this.center.y + offset.y * 4
    )
  }
  getChunkBounds(offset: Vector) {
    return new Rectangle(...this.getChunkOrigin(offset).xy, 4, 4)
  }
  getCompactMachineAtTile(tile: Vector) {
    const targetOffset = tile.sub(this.center).divideScalar(4).floor()
    for (const cm of this.compactMachines)
      if (cm.compact.offset.equals(targetOffset)) return cm
    return null
  }
}
