"use client";

import { useEffect, useRef, useState } from "react";

const IMAGES = [
  { src: "/African1.png", alt: "A Nigerian couple in traditional dress" },
  { src: "/African2.png", alt: "A Nigerian couple standing back to back" },
];

export default function Hero() {
  const [current, setCurrent] = useState(0);
  const touchStart = useRef<number | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrent((value) => (value + 1) % IMAGES.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, []);

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

        <div className="w-full border-y border-brand-dark/15 py-5 sm:py-8">
          <div className="relative mx-auto max-w-2xl [perspective:1600px]">
            <div className="relative rounded-r-lg bg-[#4A2A20] p-3 pl-5 ring-1 ring-brand-dark/30 sm:p-5 sm:pl-8">
              <div aria-hidden="true" className="absolute inset-y-0 left-2 w-px bg-brand-light/45 shadow-[3px_0_0_rgba(255,255,255,0.08)] sm:left-3" />
              <div className="border border-brand-light/70 p-1.5">
                <div className="border border-brand-light/35 p-3 sm:p-4">
                  <div className="mb-3 flex items-end justify-between border-b border-brand-light/45 pb-3 text-brand-paper">
                    <div>
                      <p className="text-[8px] font-semibold uppercase tracking-[0.35em] text-brand-light">FlavorFind</p>
                      <p className="mt-1 font-display text-base tracking-wide sm:text-lg">The Nigerian Dining Guide</p>
                    </div>
                    <span className="font-script text-2xl text-brand-light">Chapter {current + 1}</span>
                  </div>

                  <div
                    className="relative aspect-[3/2] bg-brand-paper [transform-style:preserve-3d]"
                    onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null; }}
                    onTouchEnd={(event) => {
                      if (touchStart.current === null) return;
                      const end = event.changedTouches[0]?.clientX ?? touchStart.current;
                      const distance = end - touchStart.current;
                      if (Math.abs(distance) > 45) move(distance < 0 ? 1 : -1);
                      touchStart.current = null;
                    }}
                  >
                    {IMAGES.map((image, index) => (
                      <figure
                        key={image.src}
                        aria-hidden={index !== current}
                        className={[
                          "absolute inset-0 origin-left overflow-hidden border border-brand-dark/15 bg-brand-sand transition-[transform,box-shadow] duration-1000 ease-[cubic-bezier(.645,.045,.355,1)] [backface-visibility:hidden] [transform-style:preserve-3d]",
                          index === 0
                            ? current === 0
                              ? "z-20 [transform:rotateY(0deg)] shadow-none"
                              : "z-20 [transform:rotateY(-178deg)] shadow-[20px_4px_28px_rgba(45,25,18,0.35)]"
                            : "z-10 [transform:rotateY(0deg)]",
                        ].join(" ")}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={image.src}
                          alt={image.alt}
                          draggable={false}
                          className={["h-full w-full select-none object-contain", index === 0 ? "mix-blend-multiply" : ""].join(" ")}
                        />
                        <div aria-hidden="true" className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-brand-dark/20 to-transparent" />
                      </figure>
                    ))}

                    <div className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-between bg-gradient-to-t from-brand-dark/70 to-transparent px-4 pb-3 pt-10 text-brand-paper">
                      <p className="font-script text-xl sm:text-2xl">Nigeria, from city to city</p>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => move(-1)} aria-label="Previous image" className="grid h-8 w-8 place-items-center border border-brand-paper/60 bg-brand-dark/25 backdrop-blur-sm transition hover:bg-brand-paper hover:text-brand-dark">←</button>
                        <button type="button" onClick={() => move(1)} aria-label="Next image" className="grid h-8 w-8 place-items-center border border-brand-paper/60 bg-brand-dark/25 backdrop-blur-sm transition hover:bg-brand-paper hover:text-brand-dark">→</button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex justify-center gap-2" aria-label={`Image ${current + 1} of ${IMAGES.length}`}>
                    {IMAGES.map((image, index) => (
                      <button key={image.src} type="button" onClick={() => setCurrent(index)} aria-label={`Show image ${index + 1}`} className={`h-1 transition-all ${index === current ? "w-8 bg-brand-light" : "w-4 bg-brand-paper/30"}`} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
