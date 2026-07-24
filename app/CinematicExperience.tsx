"use client";

import { useEffect, useRef } from "react";

type LenisInstance = {
  raf: (time: number) => void;
  start: () => void;
  stop: () => void;
  destroy: () => void;
  scrollTo: (
    target: number,
    options?: { duration?: number; force?: boolean; lock?: boolean },
  ) => void;
};

declare global {
  interface Window {
    Lenis?: new (options?: Record<string, unknown>) => LenisInstance;
  }
}

const FRAME_COUNT = 150;

const confrontoCopy = [
  {
    number: "01",
    label: "GUARDARE",
    copy: "La paura cresce finché scegliamo di restare immobili.",
    start: 0.025,
    end: 0.165,
    align: "left",
  },
  {
    number: "02",
    label: "SCEGLIERE",
    copy: "Il coraggio non cancella la paura. Decide di attraversarla.",
    start: 0.17,
    end: 0.285,
    align: "right",
  },
  {
    number: "03",
    label: "AFFRONTARE",
    copy: "Non diventiamo forti prima della sfida. Lo diventiamo attraversandola.",
    start: 0.29,
    end: 0.405,
    align: "left",
  },
  {
    number: "04",
    label: "SUPERARE",
    copy: "Ogni limite sconfitto smette di essere una fine.",
    start: 0.405,
    end: 0.49,
    align: "right",
  },
];

const orizzontiCopy = [
  {
    copy: "Ogni sfida superata accende una nuova possibilità.",
    start: 0.565,
    end: 0.655,
    align: "left",
  },
  {
    copy: "Ma ogni possibilità porta con sé una nuova sfida.",
    start: 0.65,
    end: 0.745,
    align: "right",
  },
  {
    copy: "Non esiste un ultimo ostacolo.",
    start: 0.74,
    end: 0.825,
    align: "left",
  },
  {
    copy: "Esistono sempre nuovi orizzonti.",
    start: 0.82,
    end: 0.905,
    align: "right",
  },
];

const framePath = (chapter: "confronto" | "orizzonti", index: number) =>
  `/frames/${chapter}/frame_${String(index + 1).padStart(4, "0")}.jpg`;

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));

const smoothstep = (start: number, end: number, value: number) => {
  const x = clamp((value - start) / (end - start));
  return x * x * (3 - 2 * x);
};

function SequenceCaption({
  number,
  label,
  copy,
  start,
  end,
  align,
  horizon = false,
}: {
  number?: string;
  label?: string;
  copy: string;
  start: number;
  end: number;
  align: string;
  horizon?: boolean;
}) {
  return (
    <div
      className={`sequence-caption sequence-caption--${align} ${
        horizon ? "sequence-caption--horizon" : ""
      }`}
      data-start={start}
      data-end={end}
    >
      {label ? (
        <div className="sequence-caption__meta">
          <span>{number}</span>
          <span className="sequence-caption__line" />
          <span>{label}</span>
        </div>
      ) : null}
      <p>{copy}</p>
    </div>
  );
}

export function CinematicExperience() {
  const rootRef = useRef<HTMLElement>(null);
  const percentRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const scrubSequence = !reduced;

    root.dataset.mode = reduced ? "reduced" : "scrub";
    document.documentElement.classList.add("is-loading");

    const loader = root.querySelector<HTMLElement>(".preloader");
    const hero = root.querySelector<HTMLElement>(".hero");
    const heroVideo = root.querySelector<HTMLVideoElement>(".hero__video");
    const heroPoster = root.querySelector<HTMLElement>(".hero__poster");
    const heroCopy = root.querySelector<HTMLElement>(".hero__copy");
    const story = root.querySelector<HTMLElement>(".sequence-story");
    const canvas = root.querySelector<HTMLCanvasElement>(".sequence-canvas");
    const blackVeil = root.querySelector<HTMLElement>(".sequence-black");
    const captions = Array.from(
      root.querySelectorAll<HTMLElement>(".sequence-caption"),
    );
    const restart = root.querySelector<HTMLButtonElement>("[data-restart]");

    let lenis: LenisInstance | undefined;
    let rafId = 0;
    let resizeTimer = 0;
    let currentFrame = 0;
    let paintedFrame = -1;
    let assetsReady = false;
    let destroyed = false;
    const images: HTMLImageElement[] = [];

    const setupLenis = () => {
      if (reduced || lenis) return;
      if (!window.Lenis) {
        window.setTimeout(setupLenis, 30);
        return;
      }
      lenis = new window.Lenis({
        duration: 1.12,
        smoothWheel: true,
        wheelMultiplier: 0.85,
        touchMultiplier: 1.05,
        autoRaf: false,
      });
      lenis.stop();
    };
    setupLenis();

    const videoReady = (video: HTMLVideoElement) =>
      new Promise<void>((resolve) => {
        if (video.readyState >= 2) {
          resolve();
          return;
        }
        const done = () => {
          video.removeEventListener("loadeddata", done);
          video.removeEventListener("error", done);
          resolve();
        };
        video.addEventListener("loadeddata", done, { once: true });
        video.addEventListener("error", done, { once: true });
        video.load();
      });

    const loadImage = (src: string, slot?: number) =>
      new Promise<void>((resolve) => {
        const image = new Image();
        image.decoding = "async";
        image.onload = () => {
          if (slot !== undefined) images[slot] = image;
          resolve();
        };
        image.onerror = () => resolve();
        image.src = src;
      });

    const sequencePaths = scrubSequence
      ? [
          ...Array.from({ length: FRAME_COUNT }, (_, index) =>
            framePath("confronto", index),
          ),
          ...Array.from({ length: FRAME_COUNT }, (_, index) =>
            framePath("orizzonti", index),
          ),
        ]
      : [];

    const readinessTasks = scrubSequence
      ? [
          videoReady(heroVideo!),
          ...sequencePaths.map((src, index) => loadImage(src, index)),
        ]
      : [
          loadImage("/posters/sfida.jpg"),
          loadImage("/posters/confronto.jpg"),
          loadImage("/posters/orizzonti.jpg"),
        ];

    let completed = 0;
    const total = readinessTasks.length;
    readinessTasks.forEach((task) => {
      task.finally(() => {
        completed += 1;
        const progress = Math.min(100, Math.round((completed / total) * 100));
        if (percentRef.current) percentRef.current.textContent = `${progress}%`;
      });
    });

    const drawCover = (
      context: CanvasRenderingContext2D,
      image: HTMLImageElement,
    ) => {
      const cw = canvas!.width;
      const ch = canvas!.height;
      const scale = Math.max(cw / image.naturalWidth, ch / image.naturalHeight);
      const width = image.naturalWidth * scale;
      const height = image.naturalHeight * scale;
      context.drawImage(
        image,
        (cw - width) / 2,
        (ch - height) / 2,
        width,
        height,
      );
    };

    const paint = (index: number) => {
      if (!canvas || !scrubSequence || !images[index]) return;
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) return;
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      drawCover(context, images[index]);
      paintedFrame = index;
    };

    const resizeCanvas = () => {
      if (!canvas || !scrubSequence) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(window.innerWidth * ratio);
      canvas.height = Math.round(window.innerHeight * ratio);
      paintedFrame = -1;
      paint(Math.round(currentFrame));
    };

    const getStoryTarget = (progress: number) => {
      if (progress <= 0.49) {
        return (progress / 0.49) * 149;
      }
      if (progress <= 0.555) {
        return 149;
      }
      if (progress >= 0.955) {
        return 299;
      }
      return 150 + ((progress - 0.555) / 0.4) * 149;
    };

    const tick = (time: number) => {
      if (destroyed) return;
      lenis?.raf(time);

      if (hero) {
        const rect = hero.getBoundingClientRect();
        const travel = Math.max(1, rect.height - window.innerHeight);
        const progress = clamp(-rect.top / travel);
        const copyFade = 1 - smoothstep(0.18, 0.68, progress);
        if (heroPoster && reduced) heroPoster.style.opacity = "1";
        if (heroCopy) {
          heroCopy.style.opacity = String(copyFade);
          heroCopy.style.transform = `translate3d(0, ${progress * -26}px, 0)`;
        }
      }

      if (scrubSequence && story && assetsReady) {
        const rect = story.getBoundingClientRect();
        const travel = Math.max(1, rect.height - window.innerHeight);
        const progress = clamp(-rect.top / travel);
        const target = getStoryTarget(progress);
        currentFrame += (target - currentFrame) * 0.115;
        const frame = Math.round(currentFrame);

        if (frame !== paintedFrame) paint(frame);

        const fadeIntoBlack =
          frame < 150 ? smoothstep(140, 149, frame) : 0;
        const fadeFromBlack =
          frame >= 150 ? 1 - smoothstep(150, 174, frame) : 0;
        if (blackVeil) {
          blackVeil.style.opacity = String(
            Math.max(fadeIntoBlack, fadeFromBlack),
          );
        }

        captions.forEach((caption) => {
          const start = Number(caption.dataset.start);
          const end = Number(caption.dataset.end);
          const center = (start + end) / 2;
          const distance = Math.abs(progress - center);
          const radius = (end - start) / 2;
          const visible = clamp(1 - distance / Math.max(radius, 0.001));
          const eased = smoothstep(0.04, 0.42, visible);
          caption.style.opacity = String(eased);
          const offset = (1 - eased) * 18;
          caption.style.transform = caption.classList.contains(
            "sequence-caption--center",
          )
            ? `translate(-50%, -50%) translate3d(0, ${offset}px, 0)`
            : `translate3d(0, ${offset}px, 0)`;
          caption.style.pointerEvents = eased > 0.5 ? "auto" : "none";
        });
      }

      rafId = window.requestAnimationFrame(tick);
    };

    Promise.allSettled(readinessTasks).then(() => {
      if (destroyed) return;
      if (percentRef.current) percentRef.current.textContent = "100%";
      assetsReady = true;
      if (scrubSequence) {
        resizeCanvas();
        paint(0);
      }
      window.setTimeout(() => {
        loader?.classList.add("is-done");
        document.documentElement.classList.remove("is-loading");
        lenis?.start();
        heroVideo?.play().catch(() => undefined);
      }, 420);
    });

    const handleResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(resizeCanvas, 120);
    };

    const restartJourney = () => {
      heroVideo?.pause();
      if (heroVideo) heroVideo.currentTime = 0;
      if (lenis) {
        lenis.scrollTo(0, { duration: 2.1, force: true, lock: true });
      } else {
        window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
      }
      window.setTimeout(() => heroVideo?.play().catch(() => undefined), 120);
    };

    window.addEventListener("resize", handleResize, { passive: true });
    restart?.addEventListener("click", restartJourney);
    rafId = window.requestAnimationFrame(tick);

    return () => {
      destroyed = true;
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(resizeTimer);
      window.removeEventListener("resize", handleResize);
      restart?.removeEventListener("click", restartJourney);
      lenis?.destroy();
      document.documentElement.classList.remove("is-loading");
    };
  }, []);

  return (
    <main ref={rootRef} className="experience">
      <div className="preloader" aria-live="polite" aria-label="Caricamento">
        <p>OGNI VIAGGIO INIZIA DAL BUIO.</p>
        <span ref={percentRef}>0%</span>
      </div>

      <section className="hero" aria-label="La sfida">
        <div className="hero__sticky">
          <video
            className="hero__video"
            src="/media/sfida.mp4"
            poster="/posters/sfida.jpg"
            muted
            autoPlay
            playsInline
            loop
            preload="auto"
            aria-hidden="true"
          />
          <div className="hero__poster" aria-hidden="true" />
          <div className="hero__shade" aria-hidden="true" />
          <div className="hero__copy">
            <p className="overline">UNA STORIA SULLA FORZA DI VIVERE</p>
            <h1>
              <span>Ogni scelta</span>
              <span>apre un universo.</span>
            </h1>
            <p className="hero__support">
              Ci sono ostacoli che sembrano pianeti. Non esistono per fermarci,
              ma per mostrarci quanta forza abbiamo.
            </p>
          </div>
          <p className="hero__cue">AFFRONTA</p>
        </div>
      </section>

      <section className="sequence-story" aria-label="Il viaggio">
        <div className="sequence-stage">
          <canvas className="sequence-canvas" aria-label="Viaggio cosmico" />
          <div className="sequence-black" aria-hidden="true" />

          {confrontoCopy.map((caption) => (
            <SequenceCaption key={caption.label} {...caption} />
          ))}

          <div
            className="sequence-caption sequence-caption--center sequence-caption--question"
            data-start="0.492"
            data-end="0.56"
          >
            <p>Pensavi fosse la fine?</p>
          </div>

          {orizzontiCopy.map((caption) => (
            <SequenceCaption
              key={caption.copy}
              {...caption}
              horizon
            />
          ))}

          <div
            className="sequence-caption sequence-caption--center sequence-caption--resolve"
            data-start="0.895"
            data-end="0.985"
          >
            <p>
              La vita è una sfida continua.
              <br />
              Ed è un privilegio poterla vivere.
            </p>
          </div>
        </div>
      </section>

      <section className="reduced-journey" aria-label="Il viaggio">
        <article className="reduced-panel reduced-panel--confronto">
          <div className="reduced-panel__inner">
            {confrontoCopy.map((item) => (
              <div className="reduced-statement" key={item.label}>
                <span>{item.number}</span>
                <div>
                  <h2>{item.label}</h2>
                  <p>{item.copy}</p>
                </div>
              </div>
            ))}
          </div>
        </article>
        <div className="mobile-darkness">
          <p>Pensavi fosse la fine?</p>
        </div>
        <article className="reduced-panel reduced-panel--orizzonti">
          <div className="reduced-panel__inner">
            {orizzontiCopy.map((item) => (
              <p className="reduced-horizon" key={item.copy}>
                {item.copy}
              </p>
            ))}
            <p className="reduced-resolve">
              La vita è una sfida continua.
              <br />
              Ed è un privilegio poterla vivere.
            </p>
          </div>
        </article>
      </section>

      <section className="manifesto" aria-labelledby="manifesto-title">
        <div className="manifesto__header">
          <p className="overline">NON ARRENDERSI</p>
          <h2 id="manifesto-title">Quello che scegliamo di diventare.</h2>
        </div>
        <div className="manifesto__rows">
          {[
            [
              "01",
              "DIFFICOLTÀ",
              "Non scegliamo ogni ostacolo. Scegliamo se affrontarlo.",
            ],
            [
              "02",
              "CORAGGIO",
              "Essere coraggiosi non significa non avere paura, ma continuare nonostante essa.",
            ],
            [
              "03",
              "ORIZZONTE",
              "Ogni limite attraversato rivela qualcosa che prima non potevamo vedere.",
            ],
            [
              "04",
              "VITA",
              "Non dobbiamo aspettare una vita senza sfide. Dobbiamo riconoscere la fortuna di poterle vivere.",
            ],
          ].map(([number, title, copy]) => (
            <article className="manifesto-row" key={number}>
              <div className="manifesto-row__label">
                <span>{number}</span>
                <span className="manifesto-row__line" />
                <h3>{title}</h3>
              </div>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="final-call" aria-labelledby="final-title">
        <div className="final-call__orbit" aria-hidden="true" />
        <div className="final-call__inner">
          <h2 id="final-title">Non smettere di avanzare.</h2>
          <p>
            Finché esiste un altro passo, esiste un altro universo possibile.
          </p>
          <button type="button" data-restart>
            RICOMINCIA IL VIAGGIO
          </button>
        </div>
      </section>

      <footer className="footer">
        <span>OGNI SCELTA APRE UN UNIVERSO</span>
        <span className="footer__line" />
        <span>© 2026</span>
      </footer>
    </main>
  );
}
