/**
 * Crop Identification Module
 *
 * Uses GPT-4 Vision to identify crops from photos taken by farmers.
 * Supports common Taiwan vegetables and provides confidence scores.
 */

import OpenAI from 'openai';
import { getAllCrops, findCropByName } from '@minori/core';
import type { CropInfo } from '@minori/shared';

let openaiClient: OpenAI | null = null;

/**
 * Gets or creates the OpenAI client instance.
 * Uses lazy initialization to avoid errors when API key is not set during testing.
 */
function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI();
  }
  return openaiClient;
}

/** Confidence threshold for reliable identification */
export const IDENTIFICATION_CONFIDENCE_THRESHOLD = 0.7;

/** Confidence threshold below which we consider the image unrecognizable */
export const UNRECOGNIZED_THRESHOLD = 0.3;

/**
 * Custom error class for crop identification failures.
 */
export class CropIdentificationError extends Error {
  constructor(
    message: string,
    public readonly code: CropIdentificationErrorCode,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'CropIdentificationError';
  }
}

export type CropIdentificationErrorCode =
  | 'INVALID_IMAGE'
  | 'API_ERROR'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'UNKNOWN';

/**
 * Result of crop identification.
 */
export interface CropIdentificationResult {
  /** Whether a crop was identified */
  identified: boolean;
  /** Identified crop info (if found in database) */
  crop?: CropInfo;
  /** Crop name as identified by AI (may not match database) */
  identifiedName?: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Growth stage if detected */
  growthStage?: 'seedling' | 'vegetative' | 'flowering' | 'fruiting' | 'mature' | 'unknown';
  /** Health status if detected */
  healthStatus?: 'healthy' | 'pest_damage' | 'disease' | 'nutrient_deficiency' | 'unknown';
  /** Additional observations from the AI */
  observations?: string;
  /** Alternative identifications if uncertain */
  alternatives?: Array<{
    name: string;
    confidence: number;
  }>;
}

/**
 * Options for crop identification.
 */
export interface IdentifyCropOptions {
  /** Image as URL or base64 string */
  image: string;
  /** Whether the image is base64 encoded (default: auto-detect) */
  isBase64?: boolean;
  /** Image MIME type for base64 images (default: image/jpeg) */
  mimeType?: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
  /** Include growth stage detection */
  detectGrowthStage?: boolean;
  /** Include health status detection */
  detectHealth?: boolean;
}

/**
 * Builds the system prompt for crop identification.
 * Includes the list of crops from the database for accurate matching.
 */
function buildSystemPrompt(): string {
  const crops = getAllCrops();
  const cropList = crops
    .map((crop) => `- ${crop.name} (${crop.id}): ${crop.aliases.join(', ')}`)
    .join('\n');

  return `You are an agricultural crop identification expert specializing in Taiwan vegetables.
Your task is to identify crops from photos taken by farmers.

## Known Crops in Database
${cropList}

## Instructions
1. Analyze the image carefully
2. Identify the crop if it matches one in our database
3. If the crop is not in the database, still identify it but note it's not in our system
4. Assess growth stage if visible (seedling, vegetative, flowering, fruiting, mature)
5. Assess health status if visible (healthy, pest_damage, disease, nutrient_deficiency)
6. Provide confidence score based on image clarity and certainty

## Confidence Scoring Guidelines
- 0.9-1.0: Clear image, definitive identification, classic crop appearance
- 0.7-0.9: Good image, confident identification, some variation from typical appearance
- 0.5-0.7: Moderate confidence, image quality or angle affects certainty
- 0.3-0.5: Low confidence, could be multiple crops, poor image quality
- 0.0-0.3: Unable to identify, not a crop, or extremely unclear

## Response Format
Respond ONLY with JSON containing:
- identified: boolean (true if a crop was detected)
- cropName: string (crop name in Traditional Chinese, e.g., "小白菜")
- confidence: number (0-1)
- growthStage: string (seedling|vegetative|flowering|fruiting|mature|unknown)
- healthStatus: string (healthy|pest_damage|disease|nutrient_deficiency|unknown)
- observations: string (brief notes about the crop in Traditional Chinese)
- alternatives: array of {name: string, confidence: number} if uncertain

Return only JSON, no other text.`;
}

/**
 * Parses the image input and returns the appropriate format for the API.
 */
function parseImageInput(
  image: string,
  isBase64?: boolean,
  mimeType: string = 'image/jpeg'
): OpenAI.Chat.Completions.ChatCompletionContentPartImage.ImageURL {
  // Auto-detect base64 if not specified
  const isDataUrl = image.startsWith('data:');
  const isHttpUrl = image.startsWith('http://') || image.startsWith('https://');

  if (isBase64 === true || (!isHttpUrl && !isDataUrl)) {
    // Assume base64 if explicitly set or if it doesn't look like a URL
    const base64Data = isDataUrl ? image : `data:${mimeType};base64,${image}`;
    return { url: base64Data };
  }

  return { url: image };
}

/**
 * Identifies a crop from an image using GPT-4 Vision.
 *
 * @param options - Identification options including image data
 * @returns Identification result with crop info and confidence
 * @throws {CropIdentificationError} When identification fails
 *
 * @example
 * ```typescript
 * // From URL
 * const result = await identifyCrop({
 *   image: 'https://example.com/crop.jpg',
 * });
 *
 * // From base64
 * const result = await identifyCrop({
 *   image: base64Data,
 *   isBase64: true,
 *   mimeType: 'image/jpeg',
 * });
 *
 * if (result.identified && result.crop) {
 *   console.log(`Identified: ${result.crop.name} (${result.confidence})`);
 * }
 * ```
 */
export async function identifyCrop(
  options: IdentifyCropOptions
): Promise<CropIdentificationResult> {
  const { image, isBase64, mimeType = 'image/jpeg' } = options;

  // Validate image input
  if (!image || image.trim().length === 0) {
    throw new CropIdentificationError('Image data is empty or invalid', 'INVALID_IMAGE');
  }

  try {
    const imageUrl = parseImageInput(image, isBase64, mimeType);

    const response = await getOpenAIClient().chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Please identify the crop in this image. Provide your analysis in the specified JSON format.',
            },
            {
              type: 'image_url',
              image_url: imageUrl,
            },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 500,
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return createUnidentifiedResult();
    }

    return parseIdentificationResponse(content);
  } catch (error) {
    // Handle specific OpenAI errors
    if (error instanceof OpenAI.APIError) {
      if (error.status === 429) {
        throw new CropIdentificationError('Rate limit exceeded', 'RATE_LIMITED', error);
      }
      if (error.status === 400) {
        throw new CropIdentificationError('Invalid image format or size', 'INVALID_IMAGE', error);
      }
      throw new CropIdentificationError(`API error: ${error.message}`, 'API_ERROR', error);
    }

    // For timeout errors
    if (error instanceof Error && error.message.includes('timeout')) {
      throw new CropIdentificationError('Request timed out', 'TIMEOUT', error);
    }

    // For other errors
    console.error('Crop identification error:', error);
    throw new CropIdentificationError(
      `Unknown error: ${error instanceof Error ? error.message : 'Unknown'}`,
      'UNKNOWN',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Parses the API response into a structured result.
 */
function parseIdentificationResponse(content: string): CropIdentificationResult {
  try {
    const parsed = JSON.parse(content) as {
      identified: boolean;
      cropName?: string;
      confidence: number;
      growthStage?: string;
      healthStatus?: string;
      observations?: string;
      alternatives?: Array<{ name: string; confidence: number }>;
    };

    // If not identified, return early
    if (!parsed.identified) {
      return {
        identified: false,
        confidence: parsed.confidence ?? 0,
        observations: parsed.observations,
      };
    }

    // Try to match crop name to database
    let crop: CropInfo | undefined;
    if (parsed.cropName) {
      crop = findCropByName(parsed.cropName);
    }

    // Normalize confidence to 0-1 range
    const confidence = Math.max(0, Math.min(1, parsed.confidence ?? 0));

    // Validate growth stage
    const validGrowthStages = [
      'seedling',
      'vegetative',
      'flowering',
      'fruiting',
      'mature',
      'unknown',
    ] as const;
    const growthStage = validGrowthStages.includes(
      parsed.growthStage as (typeof validGrowthStages)[number]
    )
      ? (parsed.growthStage as (typeof validGrowthStages)[number])
      : 'unknown';

    // Validate health status
    const validHealthStatuses = [
      'healthy',
      'pest_damage',
      'disease',
      'nutrient_deficiency',
      'unknown',
    ] as const;
    const healthStatus = validHealthStatuses.includes(
      parsed.healthStatus as (typeof validHealthStatuses)[number]
    )
      ? (parsed.healthStatus as (typeof validHealthStatuses)[number])
      : 'unknown';

    return {
      identified: true,
      crop,
      identifiedName: parsed.cropName,
      confidence,
      growthStage,
      healthStatus,
      observations: parsed.observations,
      alternatives: parsed.alternatives,
    };
  } catch {
    return createUnidentifiedResult();
  }
}

/**
 * Creates an unidentified result.
 */
function createUnidentifiedResult(): CropIdentificationResult {
  return {
    identified: false,
    confidence: 0,
  };
}

/**
 * Checks if the identification result is reliable.
 *
 * @param result - Identification result to check
 * @returns true if the identification is reliable (above threshold)
 */
export function isReliableIdentification(result: CropIdentificationResult): boolean {
  return result.identified && result.confidence >= IDENTIFICATION_CONFIDENCE_THRESHOLD;
}

/**
 * Checks if the image could not be recognized at all.
 *
 * @param result - Identification result to check
 * @returns true if the image is unrecognizable
 */
export function isUnrecognized(result: CropIdentificationResult): boolean {
  return !result.identified || result.confidence < UNRECOGNIZED_THRESHOLD;
}

/**
 * Downloads an image from LINE's content endpoint.
 *
 * @param messageId - LINE message ID containing the image
 * @param channelAccessToken - LINE channel access token
 * @returns Base64-encoded image data
 * @throws {CropIdentificationError} When download fails
 */
export async function downloadLineImage(
  messageId: string,
  channelAccessToken: string
): Promise<string> {
  const url = `https://api-data.line.me/v2/bot/message/${messageId}/content`;

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${channelAccessToken}`,
      },
    });

    if (!response.ok) {
      throw new CropIdentificationError(
        `Failed to download image: ${response.status} ${response.statusText}`,
        'API_ERROR'
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    // Determine content type from response headers
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    if (error instanceof CropIdentificationError) {
      throw error;
    }

    throw new CropIdentificationError(
      `Failed to download LINE image: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'API_ERROR',
      error instanceof Error ? error : undefined
    );
  }
}
