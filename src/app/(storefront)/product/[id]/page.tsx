import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ProductDetail from './ProductDetail'
import type { ProductParam, Product } from '@/lib/types'
import { BUILTIN_SPEC_FIELDS } from '@/lib/types'
import type { Metadata } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kanas-jewellers.vercel.app'

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const supabase = createClient()
  const { data: product } = await supabase
    .from('products')
    .select('name, description, images, sku')
    .eq('id', params.id)
    .single() as { data: Pick<Product, 'name' | 'description' | 'images' | 'sku'> | null }

  if (!product) return {}

  const title       = `${product.name} | Maisha Jewellery`
  const description = product.description ?? `${product.name} — handcrafted jewellery from Jaipur. SKU: ${product.sku}`
  const image       = product.images?.[0] ?? null
  const url         = `${BASE_URL}/product/${params.id}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: 'Maisha Jewellery',
      type: 'website',
      ...(image ? { images: [{ url: image, width: 800, height: 800, alt: product.name }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  }
}

export default async function ProductPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const [{ data: product }, { data: productParams }, { data: settingsData }] = await Promise.all([
    supabase
      .from('products')
      .select('*, categories(name, slug)')
      .eq('id', params.id)
      .eq('is_active', true)
      .single(),
    supabase
      .from('product_params')
      .select('*')
      .order('sort_order', { ascending: true }),
    supabase
      .from('site_settings')
      .select('key, value')
      .in('key', BUILTIN_SPEC_FIELDS.map((f) => f.key)),
  ])

  if (!product) notFound()

  const settingsMap = Object.fromEntries(
    (settingsData ?? []).map((r: { key: string; value: string }) => [r.key, r.value])
  )
  const builtinVisibility = {
    show_metal:        settingsMap.show_metal        !== 'false',
    show_stone:        settingsMap.show_stone        !== 'false',
    show_gross_weight: settingsMap.show_gross_weight !== 'false',
  }

  return (
    <ProductDetail
      product={product}
      productParams={(productParams as ProductParam[]) ?? []}
      builtinVisibility={builtinVisibility}
    />
  )
}
