"use client";

import { useRef, useState } from "react";

const IMAGES = [
  { src: "/African1.png", alt: "A Nigerian couple in traditional dress" },
  { src: "/African2.png", alt: "A Nigerian couple standing back to back" },
];

export default function Hero() {
  const [current, setCurrent] = useState(0);
  const touchStart = useRef<number | null>(null);

  function move(direction: -1 | 1) {
    setCurrent((value) => (value + direction + IMAGES.length) % IMAGES.length);
  }

  return (
    <section
      aria-labelledby="hero-headline"
      className="relative overflow-hidden bg-brand-sand py-14 text-brand-dark sm:py-20 lg:py-24"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[0.82fr_1.18fr] lg:gap-16 lg:px-8">
        <div className="relative z-10 flex flex-col justify-center">
          <p className="font-script text-4xl text-brand-accent sm:text-5xl">
            Come, eat well.
          </p>
          <h1
            id="hero-headline"
            className="mt-4 max-w-2xl font-display text-5xl font-normal leading-[0.95] tracking-[-0.035em] sm:text-6xl lg:text-6xl xl:text-7xl"
          >
            A considered guide to Nigeria&rsquo;s tables.
          </h1>
          <div className="my-8 h-px w-16 bg-brand-accent" />
          <p className="max-w-lg text-base leading-7 text-brand-dark/70 sm:text-lg">
            From old favourites to rooms worth crossing town for. Browse
            places to eat across Nigeria by city, cooking and occasion.
          </p>
          <a
            href="#restaurants"
            className="mt-9 inline-flex w-fit items-center gap-4 border-b border-brand-dark pb-2 text-xs font-semibold uppercase tracking-[0.24em] transition-colors hover:border-brand-accent hover:text-brand-accent"
          >
            Explore the guide <span aria-hidden="true">↘</span>
          </a>
        </div>

        <div className="w-full border border-brand-dark/20 bg-brand-cocoa shadow-[18px_18px_0_rgba(84,52,39,0.14)]">
          <div
            className="relative aspect-[3/2] overflow-hidden"
            onTouchStart={(event) => {
              touchStart.current = event.touches[0]?.clientX ?? null;
            }}
            onTouchEnd={(event) => {
              if (touchStart.current === null) return;
              const end = event.changedTouches[0]?.clientX ?? touchStart.current;
              const distance = end - touchStart.current;
              if (Math.abs(distance) > 45) move(distance < 0 ? 1 : -1);
              touchStart.current = null;
            }}
          >
            <div
              className="flex h-full transition-transform duration-700 ease-[cubic-bezier(.22,.61,.36,1)]"
              style={{ transform: `translateX(-${current * 100}%)` }}
            >
              {IMAGES.map((image, index) => (
                <figure
                  key={image.src}
                  className="h-full min-w-full bg-brand-sand"
                  aria-hidden={index !== current}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.src}
                    alt={image.alt}
                    draggable={false}
                    className={[
                      "h-full w-full select-none object-contain",
                      index === 0 ? "mix-blend-multiply" : "",
                    ].join(" ")}
                  />
                </figure>
              ))}
            </div>

            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-brand-dark/75 to-transparent px-5 pb-4 pt-12 text-brand-paper">
              <p className="font-script text-2xl">Nigeria, from city to city</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => move(-1)} aria-label="Previous image" className="grid h-9 w-9 place-items-center border border-brand-paper/60 bg-brand-dark/20 text-lg backdrop-blur-sm transition hover:bg-brand-paper hover:text-brand-dark">←</button>
                <button type="button" onClick={() => move(1)} aria-label="Next image" className="grid h-9 w-9 place-items-center border border-brand-paper/60 bg-brand-dark/20 text-lg backdrop-blur-sm transition hover:bg-brand-paper hover:text-brand-dark">→</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
