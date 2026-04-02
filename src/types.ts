export interface SliceRegion {
  left: number
  right: number
  top: number
  bottom: number
}

export interface BorderConfig {
  top: number
  bottom: number
  left: number
  right: number
}

export interface ImageItem {
  id: string
  name: string
  image: HTMLImageElement
  imageData: ImageData
  sliceRegion: SliceRegion
  alphaBleeding: boolean
  tolerance: number
}

export function sliceRegionToBorder(region: SliceRegion, imgWidth: number, imgHeight: number): BorderConfig {
  return {
    top: region.top,
    bottom: imgHeight - region.bottom,
    left: region.left,
    right: imgWidth - region.right,
  }
}
