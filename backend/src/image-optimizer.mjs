import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import sharp from 'sharp'

const s3Client = new S3Client({})
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}))

const targetBucket = process.env.TARGET_BUCKET
const productsTable = process.env.PRODUCTS_TABLE
const cloudFrontDomainName = process.env.CLOUDFRONT_DOMAIN_NAME

if (!targetBucket || !productsTable || !cloudFrontDomainName) {
  throw new Error(
    'TARGET_BUCKET, PRODUCTS_TABLE, and CLOUDFRONT_DOMAIN_NAME environment variables are required.'
  )
}

const pngCompressionLevel = toInteger(process.env.PNG_COMPRESSION_LEVEL, 9, 0, 9)
const webpQuality = toInteger(process.env.WEBP_QUALITY, 82, 1, 100)
const maxImageWidth = toInteger(process.env.MAX_IMAGE_WIDTH, 1600, 1, 8000)

export const handler = async (event) => {
  const records = event?.Records ?? []

  if (records.length === 0) {
    console.log('No S3 records to process.')
    return
  }

  for (const record of records) {
    await processRecord(record)
  }
}

async function processRecord(record) {
  const sourceBucket = record?.s3?.bucket?.name
  const encodedKey = record?.s3?.object?.key

  if (!sourceBucket || !encodedKey) {
    console.warn('Skipping malformed S3 record.', JSON.stringify(record))
    return
  }

  const sourceKey = decodeURIComponent(encodedKey.replace(/\+/g, ' '))
  const keyMatch = /^products\/([A-Za-z0-9_-]+)\.png$/i.exec(sourceKey)

  if (!keyMatch) {
    console.log(`Skipping key that does not match expected pattern: ${sourceKey}`)
    return
  }

  const productId = keyMatch[1]
  const pngKey = `products/${productId}.png`
  const webpKey = `products/${productId}.webp`

  console.log(
    JSON.stringify({
      message: 'Optimizing uploaded product image',
      sourceBucket,
      sourceKey,
      targetBucket,
      productId,
    })
  )

  const startedAt = Date.now()
  const originalBuffer = await getObjectBuffer(sourceBucket, sourceKey)

  const optimizedPngBuffer = await transformToPng(originalBuffer)
  const optimizedWebpBuffer = await transformToWebp(originalBuffer)

  await putObject(targetBucket, pngKey, optimizedPngBuffer, 'image/png')
  await putObject(targetBucket, webpKey, optimizedWebpBuffer, 'image/webp')

  const pngUrl = buildPublicUrl(cloudFrontDomainName, pngKey)
  const webpUrl = buildPublicUrl(cloudFrontDomainName, webpKey)

  await ddb.send(
    new UpdateCommand({
      TableName: productsTable,
      Key: { id: productId },
      UpdateExpression:
        'SET imageUrl = :pngUrl, imageUrlWebp = :webpUrl, imageUpdatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':pngUrl': pngUrl,
        ':webpUrl': webpUrl,
        ':updatedAt': new Date().toISOString(),
      },
    })
  )

  console.log(
    JSON.stringify({
      message: 'Optimization complete',
      sourceBucket,
      sourceKey,
      targetBucket,
      pngKey,
      webpKey,
      originalBytes: originalBuffer.byteLength,
      pngBytes: optimizedPngBuffer.byteLength,
      webpBytes: optimizedWebpBuffer.byteLength,
      durationMs: Date.now() - startedAt,
    })
  )
}

async function transformToPng(originalBuffer) {
  return getTransformPipeline(originalBuffer)
    .png({ compressionLevel: pngCompressionLevel, adaptiveFiltering: true })
    .toBuffer()
}

async function transformToWebp(originalBuffer) {
  return getTransformPipeline(originalBuffer)
    .webp({ quality: webpQuality, effort: 6 })
    .toBuffer()
}

function getTransformPipeline(originalBuffer) {
  return sharp(originalBuffer, { failOn: 'none' }).rotate().resize({
    width: maxImageWidth,
    fit: 'inside',
    withoutEnlargement: true,
  })
}

async function getObjectBuffer(bucket, key) {
  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  )

  return bodyToBuffer(response.Body)
}

async function putObject(bucket, key, body, contentType) {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: 'public, max-age=300',
    })
  )
}

async function bodyToBuffer(body) {
  if (!body) {
    throw new Error('S3 response body is empty.')
  }

  if (body instanceof Uint8Array) {
    return Buffer.from(body)
  }

  if (typeof body.transformToByteArray === 'function') {
    const bytes = await body.transformToByteArray()
    return Buffer.from(bytes)
  }

  const chunks = []
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  return Buffer.concat(chunks)
}

function buildPublicUrl(domain, key) {
  const normalizedDomain = domain.endsWith('/') ? domain.slice(0, -1) : domain
  const prefixedDomain = /^https?:\/\//i.test(normalizedDomain)
    ? normalizedDomain
    : `https://${normalizedDomain}`
  const normalizedKey = key.startsWith('/') ? key.slice(1) : key

  return `${prefixedDomain}/${normalizedKey}`
}

function toInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(value ?? '', 10)

  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.min(Math.max(parsed, min), max)
}
