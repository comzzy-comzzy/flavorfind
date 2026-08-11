"use client";

import { useState, useEffect, useCallback } from "react";

// credit: Hero images retrieved from Autiqo folder (African1.png, African2.png)
const SLIDES = [
  {
    src: "/African1.png",
    alt: "Beautiful African dining experience showcasing local cuisine and culture",
  },
  {
    src: "/African2.png",
    alt: "Joyful group of friends sharing a delicious traditional Nigerian meal",
  },
];

export default function Hero() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextSlide = useCallback(() => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % SLIDES.length);
  }, []);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prevIndex) => (prevIndex - 1 + SLIDES.length) % SLIDES.length);
  }, []);

  useEffect(() => {
    const interval = setInterval(nextSlide, 4500);
    return () => clearInterval(interval);
  }, [nextSlide]);

  return (
    <section
      aria-labelledby="hero-headline"
      className="relative isolate overflow-hidden border-b border-brand-accent/40 bg-brand-cream bg-ankara-pattern bg-[length:160px_160px] py-14 sm:py-20 lg:py-24"
    >
      {/* Cream wash keeps the headline legible over the patterned ground. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-cream/95 via-brand-cream/80 to-brand-cream/65"
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:px-8">
        {/* Headline + CTA column */}
        <div className="flex flex-col items-center gap-6 text-center lg:items-start lg:text-left">
          <span className="rounded-full bg-brand-dark/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.25em] text-brand-dark">
            Taste of Nigeria
          </span>
          <h1
            id="hero-headline"
            className="font-display text-4xl font-extrabold leading-tight text-brand-dark sm:text-5xl lg:text-6xl"
          >
            Find Nigeria&rsquo;s best restaurants, one plate at a time.
          </h1>
          <p className="max-w-xl text-base text-brand-mid sm:text-lg leading-relaxed">
            Discover vetted spots in Lagos, Abuja, Port Harcourt, and beyond. Explore top culinary spots curated by budget, cuisine, and real verified reviews.
          </p>
          <a
            href="/#restaurants"
            className="inline-flex items-center gap-2 rounded-full bg-brand-dark px-8 py-3.5 text-base font-bold text-brand-cream shadow-lg transition-transform hover:scale-105 hover:bg-brand-mid focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-light focus-visible:ring-offset-2"
          >
            Find a Restaurant
            <span aria-hidden="true">&rarr;</span>
          </a>
        </div>

        {/* Sliding Carousel Column */}
        <div className="relative w-full max-w-md mx-auto lg:max-w-none">
          <div className="relative aspect-[3/2] w-full overflow-hidden rounded-3xl border-4 border-white shadow-2xl ring-1 ring-brand-dark/10 sm:aspect-[3/2] lg:aspect-[3/2]">
            {/* Slides container */}
            <div className="relative h-full w-full bg-white overflow-hidden">
              <div
                className="flex h-full w-full transition-transform duration-700 ease-out"
                style={{ transform: `translateX(-${currentIndex * 100}%)` }}
              >
                {SLIDES.map((slide, index) => {
                  const isActive = index === currentIndex;
                  return (
                    <div
                      key={slide.src}
                      className="h-full w-full flex-shrink-0"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={slide.src}
                        alt={slide.alt}
                        className={`h-full w-full object-cover transition-transform duration-[4500ms] ease-out ${
                          isActive ? "scale-105" : "scale-100"
                        }`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Left navigation arrow */}
            <button
              onClick={prevSlide}
              aria-label="Previous slide"
              className="absolute left-4 top-1/2 -translate-y-1/2 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/70 backdrop-blur-sm text-brand-dark shadow-md transition-all hover:bg-white hover:scale-110 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path
                  fillRule="evenodd"
                  d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
                  clipRule="evenodd"
                />
              </svg>
            </button>

            {/* Right navigation arrow */}
            <button
              onClick={nextSlide}
              aria-label="Next slide"
              className="absolute right-4 top-1/2 -translate-y-1/2 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/70 backdrop-blur-sm text-brand-dark shadow-md transition-all hover:bg-white hover:scale-110 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path
                  fillRule="evenodd"
                  d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                  clipRule="evenodd"
                />
              </svg>
            </button>

            {/* Slide Dots / Indicators */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2">
              {SLIDES.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  aria-label={`Go to slide ${index + 1}`}
                  className={`h-2.5 rounded-full transition-all duration-300 ${
                    index === currentIndex ? "w-6 bg-white" : "w-2.5 bg-white/50"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}