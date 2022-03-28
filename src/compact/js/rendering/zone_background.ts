import { globalConfig } from "shapez/core/config"
import { DrawParameters } from "shapez/core/draw_parameters"
import { GameRoot } from "shapez/game/root"
import Zone from "../logic/Zone"
import { getTileContent } from "../util"

export function drawZoneBackground(
  root: GameRoot,
  parameters: DrawParameters,
  zone: Zone
) {
  const { context } = parameters
  const { tileSize } = globalConfig

  let outerColor = shapez.THEME.map.zone.outerColor
  if (root.app.settings.getAllSettings().disableTileGrid)
    outerColor = outerColor.replace(/0\.\d+\)$/, "1")

  // Make everything gray-er
  context.fillStyle = outerColor
  context.fillRect(
    zone.origin.x * tileSize,
    zone.origin.y * tileSize,
    Zone.size * tileSize,
    Zone.size * tileSize
  )

  const compactChunks = [...zone.compactMachines].map((cm) =>
    zone.getChunkOrigin(cm.compact.offset)
  )

  // This will serve as an outline for the compact chunks
  const w = 4 * tileSize
  const borderWidth = 2
  context.fillStyle = "#e7e9ea"
  for (const tile of compactChunks) {
    const { x, y } = tile.multiplyScalar(tileSize).subScalar(borderWidth)
    context.fillRect(x, y, w + borderWidth * 2, w + borderWidth * 2)
  }

  // Redraw the insides of the compact chunks
  for (const tile of compactChunks) {
    const { x, y } = tile.multiplyScalar(tileSize)
    const dpi = root.map.backgroundCacheDPI
    context.scale(1 / dpi, 1 / dpi)
    context.fillStyle = context.createPattern(
      root.map.cachedBackgroundCanvas,
      "repeat"
    )!
    context.fillRect(x * dpi - 0.5, y * dpi - 0.5, w * dpi + 1, w * dpi + 1)
    context.scale(dpi, dpi)
  }

  context.globalAlpha = 0.3
  context.strokeStyle = root.currentLayer === "regular" ? "#e7e9ea" : "#000000"
  context.lineWidth = borderWidth
  for (const tile of compactChunks) {
    const { x, y } = tile.multiplyScalar(tileSize)
    context.strokeRect(x, y, w, w)
    context.stroke()
  }

  // Draw fake resources
  context.globalAlpha = 0.5
  for (const tile of compactChunks) {
    const item = getTileContent(root, tile, "resources")
    if (!item) continue
    const { x, y } = tile.multiplyScalar(tileSize)
    context.fillStyle = item.getBackgroundColorAsResource()
    context.fillRect(x, y, w, w)
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        item.drawItemCenteredClipped(
          x + (i + 0.5) * tileSize,
          y + (j + 0.5) * tileSize,
          parameters
        )
      }
    }
  }

  context.globalAlpha = 1
}
