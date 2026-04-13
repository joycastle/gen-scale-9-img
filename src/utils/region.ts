import type { SliceRegion, BorderConfig, BorderToRegionResult } from '../types'

function clampWithin(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min
  return Math.min(Math.max(value, min), max)
}

export function clampRegion(region: SliceRegion, width: number, height: number): SliceRegion {
  const maxX = Math.max(width - 1, 0)
  const maxY = Math.max(height - 1, 0)

  const left = clampWithin(region.left, 0, maxX)
  const right = clampWithin(region.right, 0, maxX)
  const top = clampWithin(region.top, 0, maxY)
  const bottom = clampWithin(region.bottom, 0, maxY)

  return {
    left: Math.min(left, right),
    right: Math.max(left, right),
    top: Math.min(top, bottom),
    bottom: Math.max(top, bottom),
  }
}

export function regionToBorderInputs(region: SliceRegion, width: number, height: number): BorderConfig {
  const clamped = clampRegion(region, width, height)
  return {
    top: clamped.top,
    bottom: Math.max(height - clamped.bottom, 0),
    left: clamped.left,
    right: Math.max(width - clamped.right, 0),
  }
}

export function borderInputsToRegion(
  inputs: BorderConfig,
  width: number,
  height: number,
): BorderToRegionResult {
  const maxX = Math.max(width - 1, 0)
  const maxY = Math.max(height - 1, 0)

  let adjusted = false

  const left = clampWithin(inputs.left, 0, maxX)
  if (left !== inputs.left) adjusted = true

  const rightDist = clampWithin(inputs.right, 0, width)
  if (rightDist !== inputs.right) adjusted = true

  const right = clampWithin(width - rightDist, 0, maxX)

  const top = clampWithin(inputs.top, 0, maxY)
  if (top !== inputs.top) adjusted = true

  const bottomDist = clampWithin(inputs.bottom, 0, height)
  if (bottomDist !== inputs.bottom) adjusted = true

  const bottom = clampWithin(height - bottomDist, 0, maxY)

  let region: SliceRegion = { left, right, top, bottom }
  const normalized = clampRegion(region, width, height)
  if (
    normalized.left !== region.left ||
    normalized.right !== region.right ||
    normalized.top !== region.top ||
    normalized.bottom !== region.bottom
  ) {
    adjusted = true
    region = normalized
  } else {
    region = normalized
  }

  return { region, adjusted }
}
