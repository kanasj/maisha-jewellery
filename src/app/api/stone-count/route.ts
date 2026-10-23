import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

// ─── Types ────────────────────────────────────────────────────────────────────

type Confidence = 'high' | 'medium' | 'low'

interface StoneGroup {
  count: number | null
  confidence: Confidence
  notes: string
}

interface ColoredStoneGroup extends StoneGroup {
  breakdown: {
    ruby: number | null
    emerald: number | null
    sapphire: number | null
    other: number | null
  }
}

export interface StoneCountResult {
  can_count: boolean
  unable_reason: string | null
  diamonds: StoneGroup | null
  polkis: StoneGroup | null
  colored_stones: ColoredStoneGroup | null
  total_stones: number | null
  overall_confidence: Confidence | null
  image_quality: 'good' | 'fair' | 'poor'
}

// ─── Gemini pool helpers ───────────────────────────────────────────────────────

function getKeys(): string[] {
  const keys = (process.env.GEMINI_API_KEYS ?? '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean)
  if (!keys.length) throw new Error('GEMINI_API_KEYS is not set')
  return keys
}

function randomKey(): string {
  const keys = getKeys()
  return keys[Math.floor(Math.random() * keys.length)]
}

async function fileToBase64Part(file: File) {
  const bytes = await file.arrayBuffer()
  return {
    inlineData: {
      data: Buffer.from(bytes).toString('base64'),
      mimeType: file.type || 'image/jpeg',
    },
  }
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a gemologist and jewelry expert specializing in Indian fine jewelry, particularly Polki (Kundan) and diamond pieces from Jaipur.

Your task: count the diamonds, polkis, and colored stones visible in the jewelry image.

## Stone definitions
- **Diamond**: A brilliant-cut or other faceted diamond. Clear, highly reflective, sparkly. Could be round brilliant, princess, pear, etc.
- **Polki**: An uncut or minimally cut natural diamond, used traditionally in Kundan jewelry. Flat or slightly domed. Milky, cloudy, yellowish, greyish, or slightly off-white appearance. Set in gold foil (Kundan setting). NOT the same as a brilliant-cut diamond.
- **CVD / Lab diamond**: Treat the same as a regular diamond (brilliant-cut, clear) unless you can visually distinguish them — in practice you cannot from a photo.
- **Colored stone**: Ruby (red), emerald (green), sapphire (blue), or other colored gemstones. Distinguish by color.

## Counting rules
1. Count only stones you can clearly see. Do NOT guess or extrapolate hidden stones.
2. If a stone is partially hidden but clearly present, include it with a note.
3. If stones overlap significantly and you cannot tell individuals apart, you MUST set can_count to false for that group.
4. If the image is blurry, overexposed, too small, or at a bad angle, set image_quality accordingly and can_count to false if you genuinely cannot count.
5. It is MUCH better to say "unable to count" than to give a wrong number. A wrong count is worse than no count.

## When to set can_count = false
- Image is blurry or too dark/bright to see individual stones
- Stones are so densely packed that separating them is impossible
- The angle hides most stones (e.g., only the edge is visible)
- You are not confident enough to give even an approximate count
- Only set can_count = true when you genuinely believe your counts are correct

## Confidence levels (per stone group)
- **high**: You can clearly see and count every stone in this group (≥90% sure)
- **medium**: Most stones are visible but a few may be hidden or ambiguous (≥70% sure)
- **low**: Many stones are partially hidden; count is a rough estimate (≥50% sure) — but still better than unable

## Output format
Return ONLY a valid JSON object — no markdown, no code fences, no explanation.

{
  "can_count": true,
  "unable_reason": null,
  "image_quality": "good",
  "diamonds": {
    "count": 5,
    "confidence": "high",
    "notes": "Five round brilliant diamonds clearly visible in the center cluster."
  },
  "polkis": {
    "count": 12,
    "confidence": "medium",
    "notes": "Twelve polkis in the Kundan border; two may be hidden under foil."
  },
  "colored_stones": {
    "count": 3,
    "confidence": "high",
    "notes": "Three rubies set between polkis.",
    "breakdown": { "ruby": 3, "emerald": 0, "sapphire": 0, "other": 0 }
  },
  "total_stones": 20,
  "overall_confidence": "medium"
}

If can_count is false:
{
  "can_count": false,
  "unable_reason": "The image is too blurry to distinguish individual stones in the central cluster. Please provide a higher-resolution photo taken straight-on with good lighting.",
  "image_quality": "poor",
  "diamonds": null,
  "polkis": null,
  "colored_stones": null,
  "total_stones": null,
  "overall_confidence": null
}

If a stone type is simply not present (not a counting problem), return its group with count: 0, confidence: "high", notes: "None visible".

Always set total_stones to the sum of all counts, or null if can_count is false.`

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const imageFile = formData.get('image') as File | null

    if (!imageFile) {
      return NextResponse.json(
        { error: 'image field is required (multipart/form-data)' },
        { status: 400 },
      )
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
    if (!allowedTypes.includes(imageFile.type)) {
      return NextResponse.json(
        { error: `Unsupported image type: ${imageFile.type}. Use JPEG, PNG, or WebP.` },
        { status: 400 },
      )
    }

    // 20 MB guard — Gemini rejects larger inline payloads
    if (imageFile.size > 20 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Image too large. Maximum size is 20 MB.' },
        { status: 400 },
      )
    }

    const model = new GoogleGenerativeAI(randomKey()).getGenerativeModel({
      model: 'gemini-3.6-flash',
    })

    const imagePart = await fileToBase64Part(imageFile)
    const result = await model.generateContent([imagePart, { text: SYSTEM_PROMPT }])

    let text = result.response.text().trim()
    // Strip markdown fences if the model wraps output despite instructions
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

    let parsed: StoneCountResult
    try {
      parsed = JSON.parse(text)
    } catch {
      // If JSON parse fails, the model returned something unexpected — surface it
      console.error('[stone-count] JSON parse failed. Raw response:', text)
      return NextResponse.json(
        {
          error: 'Model returned an invalid response. Please try again.',
          raw: text.slice(0, 500),
        },
        { status: 502 },
      )
    }

    // Sanity-check: if overall_confidence is "low" and can_count is true,
    // rewrite total_stones to null so callers don't blindly trust a low-confidence number.
    if (parsed.can_count && parsed.overall_confidence === 'low') {
      parsed.total_stones = null
    }

    return NextResponse.json(parsed)
  } catch (err) {
    console.error('[stone-count]', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ─── Batch endpoint ───────────────────────────────────────────────────────────
// POST /api/stone-count/batch  — body: multipart with fields image_0, image_1, …

export async function PUT(request: NextRequest) {
  try {
    const formData = await request.formData()

    // Collect all image_* fields in order
    const entries: { key: string; file: File }[] = Array.from(formData.entries())
      .filter(([key, value]) => key.startsWith('image_') && value instanceof File)
      .map(([key, value]) => ({ key, file: value as File }))

    if (entries.length === 0) {
      return NextResponse.json(
        { error: 'No image fields found. Use image_0, image_1, … as field names.' },
        { status: 400 },
      )
    }

    if (entries.length > 20) {
      return NextResponse.json(
        { error: 'Batch limit is 20 images per request.' },
        { status: 400 },
      )
    }

    // Process all images in parallel (each with its own Gemini key from pool)
    const results = await Promise.all(
      entries.map(async ({ key, file }) => {
        try {
          const model = new GoogleGenerativeAI(randomKey()).getGenerativeModel({
            model: 'gemini-3.6-flash',
          })
          const imagePart = await fileToBase64Part(file)
          const result = await model.generateContent([imagePart, { text: SYSTEM_PROMPT }])

          let text = result.response.text().trim()
          text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

          const parsed: StoneCountResult = JSON.parse(text)
          if (parsed.can_count && parsed.overall_confidence === 'low') {
            parsed.total_stones = null
          }

          return { key, filename: file.name, result: parsed, error: null }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          return { key, filename: file.name, result: null, error: message }
        }
      }),
    )

    const succeeded = results.filter((r) => r.error === null).length
    const failed = results.length - succeeded

    return NextResponse.json({ total: results.length, succeeded, failed, results })
  } catch (err) {
    console.error('[stone-count/batch]', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
