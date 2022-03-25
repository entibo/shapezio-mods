import { Vector } from "shapez/core/vector"
import Zone from "./Zone"

export default class ZoneManager {
  zoneMap = new Map<number, Zone>()
  findAvailableZone(): Zone {
    let zoneId = 0
    for (; this.zoneMap.has(zoneId); zoneId++);
    const zone = new Zone(zoneId)
    this.zoneMap.set(zoneId, zone)
    return zone
  }
  getOrCreateZone(zoneId: number): Zone {
    let zone = this.zoneMap.get(zoneId)
    if (!zone) {
      zone = new Zone(zoneId)
      this.zoneMap.set(zoneId, zone)
    }
    return zone
  }
  getZoneAtTile(tile: Vector): Zone | null {
    const zoneId = Zone.getZoneIdAtTile(tile)
    if (zoneId === null) return null
    return this.zoneMap.get(zoneId) || null
  }
  freeZone(zone: Zone) {
    this.zoneMap.delete(zone.zoneId)
  }
}