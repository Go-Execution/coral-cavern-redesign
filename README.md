# Coral Cavern mockup

This project is ready to deploy to Vercel as a static site. Vercel runs the
small asset build and serves the contents of `hosting-source` directly.

## Deploy with the Vercel dashboard

1. Push this folder to a Git repository.
2. Import the repository in Vercel.
3. Leave the project root set to the repository root.
4. Deploy. The checked-in `vercel.json` selects `hosting-source` as the output
   directory and preserves the site's directory-style URLs.

## Deploy with the Vercel CLI

From this directory, run:

```powershell
npx vercel
```

Use `npx vercel --prod` when you are ready to publish the production deployment.

The website is a presentation mockup. Checkout and inquiry submissions are
simulated and do not process payments, orders, or messages.

## Motion experience

The hosted build uses pinned GSAP 3.13 and ScrollTrigger scripts from jsDelivr
for scroll-linked reveals, parallax, a responsive reef-depth sequence and 3D
pointer interactions. All essential content remains visible without GSAP, and
the experience automatically simplifies for touch devices, smaller screens,
data-saving mode and `prefers-reduced-motion` visitors.

The homepage opens with a native-scroll cinematic Canvas 2D sequence. Its
client-supplied 1280 × 720, 24fps, 10-second source was motion-interpolated into 480
desktop WebP frames and a separate 480-frame mobile crop. Frames are packed eight
per sprite sheet to reduce request overhead, then loaded progressively around the
current scroll position with limited concurrency and bounded decoded-image caches.
Chapter copy and timings live in
`hosting-source/index.html`; rendering and loading logic lives in
`src/cinematic.js`; layout lives in `src/cinematic.css`.

To regenerate the sequence from a replacement MP4:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build-cinematic-sequence.ps1 `
  -SourceVideo "C:\path\to\replacement-video.mp4"
npm run build
```

FFmpeg must be available on `PATH`. The sequence script updates both the hosted
and offline builds. `npm run build` bundles React Icons and synchronizes the
cinematic JavaScript and CSS into both output folders.
