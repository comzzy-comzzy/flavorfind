const IMAGES = [
  { src: "/African1.png", alt: "A beautifully presented Nigerian dining table" },
  { src: "/African2.png", alt: "Friends gathered around a Nigerian meal" },
];

export default function Hero() {
  return (
    <section aria-labelledby="hero-headline" className="relative overflow-hidden bg-brand-cocoa py-14 text-brand-paper sm:py-20 lg:py-24">
      <div className="mx-auto grid max-w-[1600px] lg:grid-cols-[0.88fr_1.12fr]">
        <div className="relative z-10 flex flex-col justify-center px-6 py-20 sm:px-12 lg:px-16 xl:px-24">
          <p className="font-script text-4xl text-brand-light sm:text-5xl">Come, eat well.</p>
          <h1 id="hero-headline" className="mt-4 max-w-2xl font-display text-5xl font-normal leading-[0.95] tracking-[-0.035em] sm:text-6xl xl:text-7xl">
            A considered guide to Nigeria&rsquo;s tables.
          </h1>
          <div className="my-8 h-px w-16 bg-brand-light" />
          <p className="max-w-lg text-base leading-7 text-brand-paper/75 sm:text-lg">
            From old favourites to rooms worth crossing town for. Browse places to eat across Nigeria by city, cooking and occasion.
          </p>
          <a href="#restaurants" className="mt-9 inline-flex w-fit items-center gap-4 border-b border-brand-light pb-2 text-xs font-semibold uppercase tracking-[0.24em] text-brand-paper transition-colors hover:text-brand-light">
            Explore the guide <span aria-hidden="true">↘</span>
          </a>
        </div>

        <div className="relative grid content-center gap-1 bg-brand-cocoa sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {IMAGES.map((image) => (
            <figure key={image.src} className="relative aspect-[3/2] overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.src} alt={image.alt} className="h-full w-full object-contain transition duration-700 hover:scale-[1.01]" />
              <div className="absolute inset-0 bg-brand-dark/10" />
            </figure>
          ))}
          <div className="absolute bottom-6 left-6 border border-brand-paper/40 bg-brand-dark/70 px-4 py-3 backdrop-blur-sm">
            <p className="font-script text-2xl text-brand-light">Nigeria, from city to city</p>
          </div>
        </div>
      </div>
    </section>
  );
}
