'use strict';

(() => {
  const hero = document.querySelector('[data-cinematic-hero]');
  if (!hero) return;
  hero.classList.add('cinematic-active');

  const canvas = hero.querySelector('[data-sequence-canvas]');
  const siteHeader = document.querySelector('header');
  const context = canvas.getContext('2d', { alpha: true, desynchronized: true });
  const chapters = [...hero.querySelectorAll('[data-chapter]')];
  const progressFill = hero.querySelector('[data-progress-fill]');
  const chapterLabel = hero.querySelector('[data-chapter-label]');
  const loadingLabel = hero.querySelector('[data-sequence-loading]');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saveData = Boolean(navigator.connection?.saveData);
  const mobileQuery = matchMedia('(max-width: 700px)');
  const assetRoot = location.protocol === 'file:' ? 'assets/cinematic' : '/assets/cinematic';

  const variants = {
    desktop: { count: 200, directory: 'desktop', cacheSize: 34, concurrency: 4 },
    mobile: { count: 120, directory: 'mobile', cacheSize: 22, concurrency: 3 }
  };

  let variant = mobileQuery.matches ? variants.mobile : variants.desktop;
  let currentFrame = 0;
  let currentProgress = 0;
  let lastRenderedFrame = -1;
  let ticking = false;
  let destroyed = false;
  let cache = new Map();
  let requested = new Set();
  let queue = [];
  let activeLoads = 0;
  let loadGeneration = 0;
  let resizeTimer;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const frameSource = index => `${assetRoot}/${variant.directory}/frame-${String(index + 1).padStart(4, '0')}.webp`;

  function syncStageMetrics() {
    const headerHeight = Math.max(0, Math.round(siteHeader?.getBoundingClientRect().height || 0));
    hero.style.setProperty('--cinematic-header-height', `${headerHeight}px`);
  }

  function resizeCanvas() {
    const bounds = canvas.getBoundingClientRect();
    const maxDpr = mobileQuery.matches ? 1 : 1.5;
    const dpr = Math.min(devicePixelRatio || 1, maxDpr);
    const width = Math.max(1, Math.round(bounds.width * dpr));
    const height = Math.max(1, Math.round(bounds.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      lastRenderedFrame = -1;
      renderBestFrame(currentFrame);
    }
  }

  function drawCover(image, index) {
    if (!image?.complete || !image.naturalWidth || !canvas.width || !canvas.height) return false;
    const sourceRatio = image.naturalWidth / image.naturalHeight;
    const canvasRatio = canvas.width / canvas.height;
    let sourceWidth = image.naturalWidth;
    let sourceHeight = image.naturalHeight;
    let sourceX = 0;
    let sourceY = 0;

    if (sourceRatio > canvasRatio) {
      sourceWidth = image.naturalHeight * canvasRatio;
      sourceX = (image.naturalWidth - sourceWidth) / 2;
    } else {
      sourceHeight = image.naturalWidth / canvasRatio;
      sourceY = (image.naturalHeight - sourceHeight) / 2;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
    lastRenderedFrame = index;
    canvas.dataset.renderedFrame = String(index);
    hero.classList.add('sequence-ready');
    loadingLabel?.setAttribute('hidden', '');
    return true;
  }

  function nearestLoaded(target) {
    let nearest = null;
    let distance = Infinity;
    for (const [index, image] of cache) {
      const candidateDistance = Math.abs(index - target);
      if (candidateDistance < distance) {
        nearest = [index, image];
        distance = candidateDistance;
      }
    }
    return nearest;
  }

  function renderBestFrame(target) {
    const exact = cache.get(target);
    if (exact && drawCover(exact, target)) return;
    const nearest = nearestLoaded(target);
    if (nearest && nearest[0] !== lastRenderedFrame) drawCover(nearest[1], nearest[0]);
  }

  function evictDistantFrames() {
    if (cache.size <= variant.cacheSize) return;
    const protectedFrames = new Set([0, variant.count - 1]);
    const removable = [...cache.keys()]
      .filter(index => !protectedFrames.has(index))
      .sort((a, b) => Math.abs(b - currentFrame) - Math.abs(a - currentFrame));

    while (cache.size > variant.cacheSize && removable.length) {
      const index = removable.shift();
      const image = cache.get(index);
      cache.delete(index);
      requested.delete(index);
      image?.removeAttribute('src');
    }
  }

  function pumpQueue() {
    if (destroyed) return;
    queue.sort((a, b) => Math.abs(a - currentFrame) - Math.abs(b - currentFrame));
    while (activeLoads < variant.concurrency && queue.length) {
      const index = queue.shift();
      if (cache.has(index)) continue;
      activeLoads += 1;
      const generation = loadGeneration;
      const image = new Image();
      image.decoding = 'async';
      image.fetchPriority = Math.abs(index - currentFrame) <= 2 ? 'high' : 'auto';
      image.onload = async () => {
        try { await image.decode?.(); } catch {}
        if (generation !== loadGeneration) {
          image.removeAttribute('src');
          return;
        }
        if (!destroyed) {
          cache.set(index, image);
          if (index === currentFrame || lastRenderedFrame < 0) renderBestFrame(currentFrame);
          evictDistantFrames();
        }
        activeLoads -= 1;
        pumpQueue();
      };
      image.onerror = () => {
        if (generation !== loadGeneration) return;
        requested.delete(index);
        activeLoads -= 1;
        if (index === 0 && cache.size === 0) hero.classList.add('sequence-failed');
        pumpQueue();
      };
      image.src = frameSource(index);
    }
  }

  function requestFrame(index) {
    const normalized = clamp(Math.round(index), 0, variant.count - 1);
    if (requested.has(normalized) || cache.has(normalized)) return;
    requested.add(normalized);
    queue.push(normalized);
  }

  function prioritizeFrames(target) {
    requestFrame(target);
    for (let distance = 1; distance <= 8; distance += 1) {
      requestFrame(target + distance);
      requestFrame(target - distance);
    }
    pumpQueue();
  }

  function seedSequence() {
    [0, .16, .34, .56, .72, .84, 1].forEach(progress => requestFrame(progress * (variant.count - 1)));
    prioritizeFrames(0);
  }

  function chapterOpacity(progress, start, end) {
    const fade = Math.min(.055, Math.max(.025, (end - start) * .24));
    if (progress < start || progress > end) return 0;
    if (start > 0 && progress < start + fade) return (progress - start) / fade;
    if (end < 1 && progress > end - fade) return (end - progress) / fade;
    return 1;
  }

  function updateChapters(progress) {
    let activeChapter = 0;
    let bestOpacity = 0;
    chapters.forEach((chapter, index) => {
      const start = Number(chapter.dataset.start);
      const end = Number(chapter.dataset.end);
      const opacity = clamp(chapterOpacity(progress, start, end), 0, 1);
      chapter.style.setProperty('--chapter-opacity', opacity.toFixed(3));
      chapter.style.setProperty('--chapter-lift', `${((1 - opacity) * 24).toFixed(1)}px`);
      chapter.classList.toggle('is-readable', opacity > .45);
      const hidden = opacity < .06;
      if (chapter.getAttribute('aria-hidden') !== String(hidden)) chapter.setAttribute('aria-hidden', String(hidden));
      if (opacity > bestOpacity) {
        bestOpacity = opacity;
        activeChapter = index;
      }
    });
    chapterLabel.textContent = String(activeChapter + 1).padStart(2, '0');
    progressFill.style.transform = `scaleY(${progress.toFixed(4)})`;
    hero.style.setProperty('--cinematic-progress', progress.toFixed(4));
  }

  function calculateProgress() {
    const bounds = hero.getBoundingClientRect();
    const distance = Math.max(1, hero.offsetHeight - innerHeight);
    return clamp(-bounds.top / distance, 0, 1);
  }

  function updateFromScroll() {
    ticking = false;
    currentProgress = calculateProgress();
    const nextFrame = Math.round(currentProgress * (variant.count - 1));
    canvas.dataset.targetFrame = String(nextFrame);
    if (nextFrame !== currentFrame) {
      currentFrame = nextFrame;
      prioritizeFrames(currentFrame);
      renderBestFrame(currentFrame);
    }
    updateChapters(currentProgress);
  }

  function requestScrollUpdate() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(updateFromScroll);
  }

  function activateStaticExperience() {
    hero.classList.add('is-static-experience', 'sequence-ready');
    loadingLabel?.setAttribute('hidden', '');
    currentProgress = 1;
    currentFrame = variant.count - 1;
    chapters.forEach((chapter, index) => {
      const isFinal = index === chapters.length - 1;
      chapter.style.setProperty('--chapter-opacity', isFinal ? '1' : '0');
      chapter.style.setProperty('--chapter-lift', '0px');
      chapter.classList.toggle('is-readable', isFinal);
      chapter.setAttribute('aria-hidden', String(!isFinal));
    });
    chapterLabel.textContent = '05';
    progressFill.style.transform = 'scaleY(1)';
  }

  function resetVariant() {
    const nextVariant = mobileQuery.matches ? variants.mobile : variants.desktop;
    if (nextVariant === variant) return;
    variant = nextVariant;
    loadGeneration += 1;
    cache.forEach(image => image.removeAttribute('src'));
    cache = new Map();
    requested = new Set();
    queue = [];
    activeLoads = 0;
    lastRenderedFrame = -1;
    currentFrame = Math.round(currentProgress * (variant.count - 1));
    hero.classList.remove('sequence-ready', 'sequence-failed');
    loadingLabel?.removeAttribute('hidden');
    resizeCanvas();
    prioritizeFrames(currentFrame);
  }

  function handleResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      syncStageMetrics();
      resetVariant();
      resizeCanvas();
      requestScrollUpdate();
    }, 120);
  }

  syncStageMetrics();

  if (reducedMotion || saveData || !context) {
    activateStaticExperience();
    return;
  }

  resizeCanvas();
  seedSequence();
  updateFromScroll();
  addEventListener('scroll', requestScrollUpdate, { passive: true });
  addEventListener('resize', handleResize, { passive: true });

  addEventListener('pagehide', () => {
    destroyed = true;
    removeEventListener('scroll', requestScrollUpdate);
    removeEventListener('resize', handleResize);
    cache.forEach(image => image.removeAttribute('src'));
    cache.clear();
    queue.length = 0;
  }, { once: true });
})();
