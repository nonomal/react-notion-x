import got from 'got'
import lqip from 'lqip-modern'
import pMap from 'p-map'
import pMemoize from 'p-memoize'

import { ExtendedRecordMap, PreviewImage } from 'notion-types'
import { defaultMapImageUrl } from 'react-notion-x'

// NOTE: this is just an example of how to pre-compute preview images.
// Depending on how many images you're working with, this can potentially be
// very expensive to recompute, so in production we recommend that you cache
// the preview image results in a key-value database of your choosing.
// If you're not sure where to start, check out https://github.com/jaredwray/keyv

// const exampleBlurPlaceholderUrl =
//   'data:image/gif;base64,R0lGODlhAQABAPAAAO21Bv///yH5BAAAAAAALAAAAAABAAEAAAICRAEAOw=='

export async function getPreviewImages(recordMap: ExtendedRecordMap) {
  const blockIds = Object.keys(recordMap.block)
  const imageUrls: string[] = blockIds
    .map((blockId) => {
      const block = recordMap.block[blockId]?.value

      if (block) {
        if (block.type === 'image') {
          const signedUrl = recordMap.signed_urls?.[block.id]
          const source = signedUrl || block.properties?.source?.[0]?.[0]

          if (source) {
            return {
              block,
              url: source
            }
          }
        }

        if ((block.format as any)?.page_cover) {
          const source = (block.format as any).page_cover

          return {
            block,
            url: source
          }
        }
      }

      return null
    })
    .filter(Boolean)
    .map(({ block, url }) => defaultMapImageUrl(url, block))
    .filter(Boolean)

  const urls = Array.from(new Set(imageUrls))
  const previewImagesMap = Object.fromEntries(
    await pMap(urls, async (url) => [url, await getPreviewImage(url)], {
      concurrency: 8
    })
  )
  recordMap.preview_images = previewImagesMap
}

async function createPreviewImage(url: string): Promise<PreviewImage | null> {
  try {
    const { body } = await got(url, { responseType: 'buffer' })
    const result = await lqip(body)
    console.log('lqip', result.metadata)

    return {
      originalWidth: result.metadata.originalWidth,
      originalHeight: result.metadata.originalHeight,
      dataURIBase64: result.metadata.dataURIBase64
    }
  } catch (err) {
    console.warn('error creating preview image', url, err)
    return null
  }
}

export const getPreviewImage = pMemoize(createPreviewImage)
