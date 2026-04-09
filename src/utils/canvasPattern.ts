const checkerCanvases: Record<string, HTMLCanvasElement> = {}

function createCheckerCanvas(isDark: boolean): HTMLCanvasElement {
  const pc = document.createElement('canvas')
  pc.width = 16
  pc.height = 16
  const pctx = pc.getContext('2d')!
  if (isDark) {
    pctx.fillStyle = '#2d2d2d'
    pctx.fillRect(0, 0, 16, 16)
    pctx.fillStyle = '#3c3c3c'
    pctx.fillRect(0, 0, 8, 8)
    pctx.fillRect(8, 8, 8, 8)
  } else {
    pctx.fillStyle = '#fafafa'
    pctx.fillRect(0, 0, 16, 16)
    pctx.fillStyle = '#f0f0f0'
    pctx.fillRect(0, 0, 8, 8)
    pctx.fillRect(8, 8, 8, 8)
  }
  return pc
}

export function getCheckerPattern(ctx: CanvasRenderingContext2D, isDark: boolean): CanvasPattern {
  const key = isDark ? 'dark' : 'light'
  if (!checkerCanvases[key]) {
    checkerCanvases[key] = createCheckerCanvas(isDark)
  }
  return ctx.createPattern(checkerCanvases[key], 'repeat')!
}
