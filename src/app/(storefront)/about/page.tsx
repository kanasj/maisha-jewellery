export default function AboutPage() {
  return (
    <div>
      <div className="bg-[#1A1714] py-32 text-center">
        <p className="text-xs tracking-[0.4em] uppercase text-[#B8973A] mb-4">Our Story</p>
        <h1 className="font-cormorant text-6xl font-light text-white">About Us</h1>
      </div>
      <div className="max-w-3xl mx-auto px-4 py-20">
        <p className="font-cormorant text-2xl font-light text-[#1A1714] leading-relaxed mb-8 italic">
          &ldquo;Jewellery is not just an ornament — it is a memory, a legacy, a feeling.&rdquo;
        </p>
        <div className="space-y-6 text-[#1A1714]/70 leading-relaxed text-sm">
          <p>
            Maisha Jewellery was born from a deep love for craftsmanship and a passion for creating pieces that transcend time. Every ring, necklace, earring, and bracelet in our collection is thoughtfully designed and carefully crafted.
          </p>
          <p>
            We work with the finest metals and gemstones, sourced responsibly, to bring you jewellery that is as beautiful as it is meaningful. Our artisans bring decades of experience to every piece they touch.
          </p>
          <p>
            We believe that beautiful jewellery should be accessible. That&apos;s why we work directly with you — no intermediaries, no showroom overheads. Just honest pricing, exquisite craft, and a personal connection.
          </p>
        </div>
        <div className="border-t border-[#E8E0D5] mt-12 pt-12">
          <p className="text-xs tracking-[0.4em] uppercase text-[#B8973A] mb-4">Get In Touch</p>
          <p className="text-sm text-[#1A1714]/70 mb-6">We&apos;d love to hear from you. Whether you&apos;re looking for something special or have a custom piece in mind, reach out on WhatsApp.</p>
          <a
            href="https://wa.me/916377758170?text=Hi%21%20I%27d%20like%20to%20learn%20more%20about%20Maisha%20Jewellers."
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-[#B8973A] text-white text-xs tracking-[0.3em] uppercase px-8 py-4 hover:bg-[#A07C2A] transition-colors"
          >
            Message Us on WhatsApp
          </a>
        </div>
      </div>
    </div>
  )
}
