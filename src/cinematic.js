'use strict';

(() => {
  const hero = document.querySelector('[data-cinematic-hero]');
  if (!hero) return;
  hero.classList.add('cinematic-active');
  document.body.classList.add('cinematic-page');

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
    desktop: { count: 240, directory: 'desktop', cacheSize: 32, concurrency: 4, lookAhead: 18, lookBehind: 8, damping: 13 },
    mobile: { count: 240, directory: 'mobile', cacheSize: 36, concurrency: 3, lookAhead: 14, lookBehind: 6, damping: 11 }
  };

  let variant = mobileQuery.matches ? variants.mobile : variants.desktop;
  let currentFrame = 0;
  let currentProgress = 0;
  let targetProgress = 0;
  let lastRenderedFrame = -1;
  let animationFrame = 0;
  let lastTick = 0;
  let scrollDirection = 1;
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
    const dpr = Math.min(devicePixelRatio || 1, 1);
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
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
    lastRenderedFrame = index;
    canvas.dataset.renderedFrame = String(index);
    hero.classList.add('sequence-ready');
    loadingLabel?.setAttribute('hidden', '');
    return true;
  }

  function nearestLoaded(target) {
    if (lastRenderedFrame >= 0) {
      const directional = [...cache.entries()].filter(([index]) => scrollDirection > 0
        ? index >= lastRenderedFrame && index <= target
        : index <= lastRenderedFrame && index >= target);
      if (directional.length) {
        const maxStep = mobileQuery.matches ? 4 : 6;
        const bridged = directional.filter(([index]) => Math.abs(index - lastRenderedFrame) <= maxStep);
        if (!bridged.length) return null;
        bridged.sort((a, b) => Math.abs(b[0] - lastRenderedFrame) - Math.abs(a[0] - lastRenderedFrame));
        return bridged[0];
      }
      return null;
    }
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
    const nearest = nearestLoaded(target);
    if (nearest && nearest[0] !== lastRenderedFrame) drawCover(nearest[1], nearest[0]);
  }

  function evictDistantFrames() {
    if (cache.size <= variant.cacheSize) return;
    const protectedFrames = new Set([0, variant.count - 1]);
    const evictionFocus = lastRenderedFrame >= 0 && Math.abs(currentFrame - lastRenderedFrame) > variant.lookAhead
      ? lastRenderedFrame
      : currentFrame;
    const removable = [...cache.keys()]
      .filter(index => !protectedFrames.has(index))
      .sort((a, b) => Math.abs(b - evictionFocus) - Math.abs(a - evictionFocus));

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
    const gap = lastRenderedFrame < 0 ? 0 : currentFrame - lastRenderedFrame;
    const loadFocus = Math.abs(gap) > 4
      ? lastRenderedFrame + Math.sign(gap) * Math.min(6, Math.abs(gap))
      : currentFrame;
    queue.sort((a, b) => Math.abs(a - loadFocus) - Math.abs(b - loadFocus));
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
          renderBestFrame(currentFrame);
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

  function trimQueue(target) {
    const keepDistance = Math.max(32, variant.lookAhead * 2);
    queue = queue.filter(index => {
      const keep = Math.abs(index - target) <= keepDistance || index === 0 || index === variant.count - 1;
      if (!keep) requested.delete(index);
      return keep;
    });
  }

  function prioritizeFrames(target, direction = scrollDirection) {
    trimQueue(target);
    if (lastRenderedFrame >= 0 && Math.abs(target - lastRenderedFrame) > 1) {
      const bridgeDirection = target > lastRenderedFrame ? 1 : -1;
      const bridgeLength = Math.min(12, Math.abs(target - lastRenderedFrame));
      for (let distance = 1; distance <= bridgeLength; distance += 1) {
        requestFrame(lastRenderedFrame + distance * bridgeDirection);
      }
    }
    requestFrame(target);
    const ahead = saveData ? Math.min(8, variant.lookAhead) : variant.lookAhead;
    const behind = saveData ? Math.min(4, variant.lookBehind) : variant.lookBehind;
    for (let distance = 1; distance <= ahead; distance += 1) {
      requestFrame(target + distance * direction);
    }
    for (let distance = 1; distance <= behind; distance += 1) {
      requestFrame(target - distance * direction);
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

  function renderProgress(progress) {
    const nextFrame = Math.round(progress * (variant.count - 1));
    canvas.dataset.targetFrame = String(nextFrame);
    if (nextFrame !== currentFrame) {
      currentFrame = nextFrame;
      prioritizeFrames(currentFrame, scrollDirection);
      renderBestFrame(currentFrame);
    }
    updateChapters(progress);
  }

  function animateTowardsTarget(timestamp) {
    animationFrame = 0;
    const delta = Math.min(50, lastTick ? timestamp - lastTick : 16.67);
    lastTick = timestamp;
    const remaining = targetProgress - currentProgress;

    if (Math.abs(remaining) <= .00012) {
      currentProgress = targetProgress;
      renderProgress(currentProgress);
      lastTick = 0;
      return;
    }

    scrollDirection = remaining > 0 ? 1 : -1;
    const blend = 1 - Math.exp(-variant.damping * delta / 1000);
    currentProgress += remaining * blend;
    renderProgress(currentProgress);
    animationFrame = requestAnimationFrame(animateTowardsTarget);
  }

  function requestScrollUpdate() {
    const nextProgress = calculateProgress();
    if (nextProgress !== targetProgress) scrollDirection = nextProgress > targetProgress ? 1 : -1;
    targetProgress = nextProgress;
    const destinationFrame = Math.round(targetProgress * (variant.count - 1));
    canvas.dataset.destinationFrame = String(destinationFrame);
    requestFrame(destinationFrame);
    requestFrame(destinationFrame + scrollDirection);
    pumpQueue();
    if (!animationFrame) animationFrame = requestAnimationFrame(animateTowardsTarget);
  }

  function activateStaticExperience() {
    hero.classList.add('is-static-experience', 'sequence-ready');
    loadingLabel?.setAttribute('hidden', '');
    currentProgress = 1;
    targetProgress = 1;
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

  if (reducedMotion || !context) {
    activateStaticExperience();
    return;
  }

  resizeCanvas();
  seedSequence();
  targetProgress = calculateProgress();
  currentProgress = targetProgress;
  canvas.dataset.destinationFrame = String(Math.round(targetProgress * (variant.count - 1)));
  renderProgress(currentProgress);
  addEventListener('scroll', requestScrollUpdate, { passive: true });
  addEventListener('resize', handleResize, { passive: true });

  addEventListener('pagehide', () => {
    destroyed = true;
    if (animationFrame) cancelAnimationFrame(animationFrame);
    removeEventListener('scroll', requestScrollUpdate);
    removeEventListener('resize', handleResize);
    cache.forEach(image => image.removeAttribute('src'));
    cache.clear();
    queue.length = 0;
  }, { once: true });
})();
