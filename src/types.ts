export interface SliceRegion {
  top: number
  bottom: number
  left: number
  right: number
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
  image: HTMLImageElement | ImageBitmap
  imageData: ImageData
  sliceRegion: SliceRegion
  alphaBleeding: boolean
  tolerance: number
}

export interface BorderToRegionResult {
  region: SliceRegion
  adjusted: boolean
}
