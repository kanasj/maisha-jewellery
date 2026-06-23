import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

function getKeys() {
  const keys = (process.env.GEMINI_API_KEYS ?? '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean)
  if (!keys.length) throw new Error('GEMINI_API_KEYS is not set')
  return keys
}

function randomKey() {
  const keys = getKeys()
  return keys[Math.floor(Math.random() * keys.length)]
}

function buildPrompt(categories: { id: string; name: string }[], subcategoryOptions: string[]) {
  const categoryList = categories.length
    ? categories.map((c) => `  - id: "${c.id}", name: "${c.name}"`).join('\n')
    : '  (none provided)'

  const subcategoryList = subcategoryOptions.length
    ? subcategoryOptions.map((o) => `  - "${o}"`).join('\n')
    : '  (none provided)'

  return `You are an expert at reading Indian jewelry tags and identifying jewelry pieces.

You will be given one or two images:
1. A jewelry TAG image (the first image) — a physical label/tag attached to the jewelry
2. A JEWELRY image (the second image, if provided) — a photo of the actual piece

Extract details and return ONLY a valid JSON object — no markdown, no explanation, no code blocks.

From the TAG image, read:
- sku: item code / article number / SKU from the tag
- metal_type: normalize to exactly one of "Gold", "Silver", "Platinum", "Rose Gold" (or null)
- metal_purity: just the number — e.g. "18" for 18K, "22" for 22K, "14" for 14K, "9" for 9K, "24" for 24K (or null)
- gross_weight_g: gross weight in grams as a number (or null)
- net_weight_gm: net weight in grams as a number (or null)
- stone_weight_ct: weight of natural/mined diamonds or gemstones in carats (or null). Do NOT put CVD or polki weight here.
- cvd_weight_ct: weight of CVD (lab-grown) diamonds in carats — look for "CVD" label on the tag (or null)
- polki_weight_ct: weight of polki diamonds in carats — look for "Polki" label on the tag (or null)
- stone_details: full description of stones e.g. "1 solitaire diamond 0.25ct VS clarity, CVD 3.00ct" (or null)
- og_price_inr: original price / MRP in INR as a number (or null)

IMPORTANT for weights: each weight field is separate.
- If the tag says "CVD - 3.00 ct" → put 3.00 in cvd_weight_ct, leave stone_weight_ct null
- If the tag says "Diamond - 0.25 ct" → put 0.25 in stone_weight_ct
- If the tag says "Polki - 2.00 ct" → put 2.00 in polki_weight_ct
- Multiple weights can be filled at once if the tag shows all of them

From the JEWELRY image (if provided), generate:
- name: concise product name e.g. "Diamond Solitaire Ring", "Gold Jhumka Earrings", "Polki Necklace Set"
- description: 2-3 sentences of evocative copy for this jewelry piece. We are Maisha Jewellery — manufacturers from Jaipur with a heritage of fine craftsmanship. Write with a tone that blends traditional Rajasthani artistry with modern elegance: poetic but grounded, luxurious without being over the top. Highlight the design, the stone or metal work, and the occasion it suits. Draw on heritage/legacy language where it fits (e.g. "rooted in centuries of Jaipuri craftsmanship", "handcrafted in the pink city's finest ateliers", "a timeless silhouette that bridges old-world grandeur and contemporary grace"). Keep it between 40-60 words.
- tags: array of relevant lowercase tags e.g. ["bridal", "diamond", "ring", "solitaire"]

If no jewelry image is provided, infer name/description/tags from the tag details and write the description with the same heritage tone.

CATEGORY MATCHING — Available categories in this store:
${categoryList}

From the jewelry type visible in the images or tag, pick the best matching category_id from the list above.
- If a clear match exists, set category_id to that id string
- If no good match exists, set category_id to null and set category_hint to what category name you think is needed (e.g. "Pendant Set", "Bangles")

JEWELLERY SUBCATEGORY — Available subcategory options:
${subcategoryList}

Pick the best matching jewellery_sub_category value from the list above exactly as written.
- If a clear match exists, set jewellery_sub_category to that exact string
- If no match exists, set jewellery_sub_category to null

Return exactly this JSON shape (use null for unknown fields, empty array for unknown tags):
{
  "sku": "",
  "name": "",
  "description": "",
  "metal_type": null,
  "metal_purity": null,
  "gross_weight_g": null,
  "net_weight_gm": null,
  "stone_weight_ct": null,
  "cvd_weight_ct": null,
  "polki_weight_ct": null,
  "stone_details": null,
  "og_price_inr": null,
  "category_id": null,
  "category_hint": null,
  "jewellery_sub_category": null,
  "tags": []
}`
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

export async function POST(request: NextRequest) {
  try {
    const formData    = await request.formData()
    const tagImage     = formData.get('tag_image')     as File | null
    const jewelryImage = formData.get('jewelry_image') as File | null
    const categoriesRaw       = formData.get('categories')         as string | null
    const subcategoryRaw      = formData.get('subcategory_options') as string | null

    if (!tagImage) {
      return NextResponse.json({ error: 'tag_image is required' }, { status: 400 })
    }

    const categories: { id: string; name: string }[] = categoriesRaw  ? JSON.parse(categoriesRaw)  : []
    const subcategoryOptions: string[]               = subcategoryRaw ? JSON.parse(subcategoryRaw) : []

    const model = new GoogleGenerativeAI(randomKey()).getGenerativeModel({ model: 'gemini-2.5-flash' })

    const tagPart = await fileToBase64Part(tagImage)
    const contentParts: ({ text: string } | { inlineData: { data: string; mimeType: string } })[] = [
      tagPart,
    ]
    if (jewelryImage) {
      contentParts.push(await fileToBase64Part(jewelryImage))
    }
    contentParts.push({ text: buildPrompt(categories, subcategoryOptions) })

    const result = await model.generateContent(contentParts)
    let text = result.response.text().trim()

    // Strip markdown code fences if present
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

    const parsed = JSON.parse(text)
    return NextResponse.json(parsed)
  } catch (err) {
    console.error('[sku-identify]', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
