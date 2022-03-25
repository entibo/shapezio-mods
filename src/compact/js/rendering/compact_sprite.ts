import { BufferMaintainer } from "shapez/core/buffer_maintainer"
import { globalConfig } from "shapez/core/config"
import { DrawParameters } from "shapez/core/draw_utils"
import { Rectangle } from "shapez/core/rectangle"
import { Vector } from "shapez/core/vector"
import { Entity } from "shapez/game/entity"
import { CHUNK_OVERLAY_RES, MapChunkView } from "shapez/game/map_chunk_view"
import { GameRoot } from "shapez/savegame/savegame"
import { makeEmptyChunkSizedArray } from "../util"

const emptyChunkSizedArray = makeEmptyChunkSizedArray()

export function getCompactSprite(opts: CompactSpriteRedrawOpts) {
  const { root, key, subKey } = opts
  const buffer = root.buffers.getForKey({
    key,
    subKey,
    w: CHUNK_OVERLAY_RES * 4,
    h: CHUNK_OVERLAY_RES * 4,
    dpi: 1,
    redrawMethod: generateCompactSpriteBuffer as RedrawMethod,
    additionalParams: opts,
  })
  return {
    buffer,
    draw(parameters: DrawParameters, x: number, y: number) {
      parameters.context.imageSmoothingEnabled = false
      parameters.context.drawImage(
        buffer,
        x,
        y,
        globalConfig.tileSize,
        globalConfig.tileSize
      )
      parameters.context.imageSmoothingEnabled = true
    },
  }
}

function generateCompactSpriteBuffer(
  _canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  w: number,
  h: number,
  _dpi: number,
  { root, contents, localTileOffset }: CompactSpriteRedrawOpts
) {
  localTileOffset = localTileOffset || new Vector(0, 0)

  let empty = true
  for (const [x, y] of Rectangle.fromSquare(...localTileOffset.xy, 4)) {
    if (!contents[x][y]) continue
    empty = false
    break
  }

  const [emptyColor, filledColor, beltColor, chunkBordersColor] = [
    shapez.THEME.map.chunkOverview.empty,
    shapez.THEME.map.chunkOverview.filled,
    shapez.THEME.map.chunkOverview.beltColor,
    shapez.THEME.map.chunkBorders,
  ]
  shapez.THEME.map.chunkOverview.empty = "rgba(127,127,127,0.3)"
  shapez.THEME.map.chunkOverview.filled = "transparent"
  shapez.THEME.map.chunkOverview.beltColor = "#d2d4d9"
  shapez.THEME.map.chunkBorders = "transparent"

  MapChunkView.prototype.generateOverlayBuffer.call(
    {
      root,
      // The method only checks its length
      containedEntities: empty ? [] : [null],
      lowerLayer: emptyChunkSizedArray,
      wireContents: emptyChunkSizedArray,
      contents,
    },
    context,
    w * 4,
    h * 4,
    -localTileOffset.x * CHUNK_OVERLAY_RES,
    -localTileOffset.y * CHUNK_OVERLAY_RES
  )

  shapez.THEME.map.chunkOverview.empty = emptyColor
  shapez.THEME.map.chunkOverview.filled = filledColor
  shapez.THEME.map.chunkOverview.beltColor = beltColor
  shapez.THEME.map.chunkBorders = chunkBordersColor
}

type RedrawMethod = Parameters<BufferMaintainer["getForKey"]>[0]["redrawMethod"]

type CompactSpriteRedrawOpts = {
  root: GameRoot
  contents: (Entity | null)[][]
  localTileOffset?: Vector
  key: string
  subKey: string
}
