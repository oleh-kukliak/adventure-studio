/* ============================================================
   Adventure Studio — embed-safe script
   Wrapped in IIFE — nothing leaks to window.
   Targets only elements with the as- prefix.
   ============================================================ */
(function () {
  'use strict';

  // ===== Wait for DOM and external libs =====
  function waitForLibs(cb) {
    if (typeof SanityClient !== 'undefined' && typeof gsap !== 'undefined') {
      cb();
    } else {
      setTimeout(function () { waitForLibs(cb); }, 50);
    }
  }

  function init() {
    var root = document.querySelector('.as-root');
    if (!root) return;

    // ===== Constants =====
    var GRADIENTS = [
      ['#c45f3a', '#8b2e12'], ['#4a7cc4', '#1a3d7a'], ['#7cba4a', '#3d7a1a'],
      ['#c4a43a', '#7a5e1a'], ['#9c4ac4', '#4a1a7a'], ['#c43a6e', '#7a1a3d'],
      ['#3ac4b8', '#1a7a70'], ['#c4823a', '#7a4a1a'], ['#3a6ec4', '#1a3d7a'],
      ['#c43a3a', '#7a1a1a'], ['#8ac43a', '#4a7a1a'], ['#3ac46e', '#1a7a3d'],
      ['#c4b83a', '#7a701a'], ['#3a8ac4', '#1a4a7a'], ['#a43ac4', '#5a1a7a']
    ];

    var SIZES = { sm: 112, md: 142, lg: 172 };
    var SPEED = 0.012;
    var SPEED_LERP = 0.04;

    // ===== State =====
    var projects = [];
    var cardEls = [];
    var cardData = [];
    var orbitRunning = true;
    var hoveredId = null;
    var lastTime = 0;
    var currentSpeed = SPEED;
    var arcTable = null;
    var globalArc = 0;

    var currentTrackIndex = 0;
    var currentProjectId = 0;
    var isPlaying = false;
    var progressInterval = null;
    var savedScrollY = 0;

    var mouseX = window.innerWidth / 2;
    var mouseY = window.innerHeight / 2;

    var _sizeOffsets = [8, -10, 12, -6, 10, -12, 6, -8, 14, -10, 4, -14, 8, -6, 12];
    var _cardIdx = 0;

    // ===== DOM refs (all scoped via id with as- prefix) =====
    var audio = document.getElementById('as-audioPlayer');
    var modalOverlay = document.getElementById('as-modalOverlay');
    var modalContentWrap = document.getElementById('as-modalContentWrap');
    var modalTitle = document.getElementById('as-modalTitle');
    var modalTags = document.getElementById('as-modalTags');
    var modalBy = document.getElementById('as-modalBy');
    var modalArt = document.getElementById('as-modalArt');
    var modalTrackLabel = document.getElementById('as-modalTrackLabel');
    var playerBar = document.getElementById('as-playerBar');
    var playBtn = document.getElementById('as-playBtn');
    var prevTrackBtn = document.getElementById('as-prevTrack');
    var nextTrackBtn = document.getElementById('as-nextTrack');
    var modalPrev = document.getElementById('as-modalPrev');
    var modalNext = document.getElementById('as-modalNext');
    var modalClose = document.getElementById('as-modalClose');
    var stage = document.getElementById('as-orbitStage');
    var studioTitle = root.querySelector('.as-studio-title');

    // ===== Sanity client =====
    var client = SanityClient.createClient({
      projectId: 'ohv24xqo',
      dataset: 'production',
      useCdn: true,
      apiVersion: '2023-01-01'
    });

    // ===== Helpers =====
    function makeSVGart(gradient, w, h) {
      var c1 = gradient[0], c2 = gradient[1];
      var id = 'g' + Math.random().toString(36).slice(2);
      return '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h +
        '" viewBox="0 0 ' + w + ' ' + h + '" class="as-card-img-placeholder" aria-hidden="true">' +
        '<defs><linearGradient id="' + id + '" x1="0%" y1="0%" x2="100%" y2="100%">' +
        '<stop offset="0%" stop-color="' + c1 + '"/><stop offset="100%" stop-color="' + c2 + '"/>' +
        '</linearGradient></defs>' +
        '<rect width="' + w + '" height="' + h + '" fill="url(#' + id + ')"/>' +
        '<circle cx="' + (w * 0.35) + '" cy="' + (h * 0.42) + '" r="' + (w * 0.28) + '" fill="rgba(255,255,255,0.08)"/>' +
        '<circle cx="' + (w * 0.7) + '" cy="' + (h * 0.65) + '" r="' + (w * 0.18) + '" fill="rgba(0,0,0,0.12)"/>' +
        '<rect x="' + (w * 0.1) + '" y="' + (h * 0.55) + '" width="' + (w * 0.3) + '" height="' + (h * 0.3) +
        '" rx="4" fill="rgba(255,255,255,0.05)" transform="rotate(-15 ' + (w * 0.25) + ' ' + (h * 0.7) + ')"/>' +
        '</svg>';
    }

    function makeTagsHTML(tags) {
      return tags.map(function (t) { return '<span class="as-tag">' + t + '</span>'; }).join('');
    }

    function makeByHTML(by) {
      return by.map(function (p) {
        var avatarContent = p.avatarUrl
          ? '<img src="' + p.avatarUrl + '" class="as-by-avatar-img" alt="">'
          : '<div class="as-by-avatar" style="background:' + p.color + '">' + p.initials + '</div>';
        return '<div class="as-by-item">' + avatarContent +
               '<span class="as-by-name">' + p.name + '</span></div>';
      }).join('<span class="as-by-divider">·</span>');
    }

    function makeArtHTML(project, w) {
      if (project.image) {
        return '<img src="' + project.image + '" class="as-card-img" style="width:' + w +
               'px; height:' + w + 'px;" alt="' + project.title + '">';
      }
      return makeSVGart(project.gradient, w, w);
    }

    function createCard(project) {
      var w = SIZES[project.size] || SIZES.md;
      w += _sizeOffsets[_cardIdx++ % _sizeOffsets.length];
      var el = document.createElement('div');
      el.className = 'as-card';
      el.dataset.id = project.id;
      el.dataset.baseW = w;
      el.style.width = w + 'px';
      el.innerHTML =
        '<div class="as-card-inner">' +
          makeArtHTML(project, w) +
          '<div class="as-card-info"><div class="as-card-info-inner">' +
            '<div class="as-card-title">' + project.title + '</div>' +
            '<div class="as-card-tags">' + makeTagsHTML(project.tags) + '</div>' +
          '</div></div>' +
        '</div>';
      return el;
    }

    // ===== Arc math =====
    function buildArcTable(rx, ry) {
      var STEPS = 10000;
      var dTheta = (2 * Math.PI) / STEPS;
      var arc = new Float64Array(STEPS + 1);
      for (var i = 1; i <= STEPS; i++) {
        var t = (i - 0.5) * dTheta;
        var ds = Math.sqrt(Math.pow(rx * Math.sin(t), 2) + Math.pow(ry * Math.cos(t), 2)) * dTheta;
        arc[i] = arc[i - 1] + ds;
      }
      return { total: arc[STEPS], dTheta: dTheta, arc: arc, STEPS: STEPS };
    }

    function angleAtArc(table, target) {
      var total = table.total, dTheta = table.dTheta, arc = table.arc, STEPS = table.STEPS;
      target = ((target % total) + total) % total;
      var lo = 0, hi = STEPS;
      while (hi - lo > 1) {
        var mid = (lo + hi) >> 1;
        if (arc[mid] < target) lo = mid; else hi = mid;
      }
      var frac = arc[hi] - arc[lo] > 0 ? (target - arc[lo]) / (arc[hi] - arc[lo]) : 0;
      return (lo + frac) * dTheta;
    }

    function computeEvenArcPhases(table, n, widths) {
      var total = table.total;
      if (!widths || widths.length !== n) {
        var phases = [];
        for (var k = 0; k < n; k++) phases.push((k / n) * total);
        return phases;
      }
      var totalWidth = widths.reduce(function (s, w) { return s + w; }, 0);
      var gap = (total - totalWidth) / n;
      var phases2 = [];
      var cursor = 0;
      for (var k2 = 0; k2 < n; k2++) {
        cursor += gap / 2 + widths[k2] / 2;
        phases2.push(cursor);
        cursor += widths[k2] / 2 + gap / 2;
      }
      return phases2;
    }

    function updatePositions() {
      if (!arcTable) return;
      cardData.forEach(function (cd) {
        var angle = angleAtArc(arcTable, cd.arcPhase + globalArc);
        var x = cd.cx + cd.rx * Math.cos(angle);
        var y = cd.cy + cd.ry * Math.sin(angle);
        var w = cd.baseW;
        cd.el.style.left = (x - w / 2) + 'px';
        cd.el.style.top = (y - w / 2) + 'px';
        var sinA = Math.sin(angle);
        cd.el.style.zIndex = Math.round(50 + sinA * 40);
        cd.el.style.opacity = '1';
      });
    }

    // ===== Smart hover positioning (clamp inside section viewport) =====
    function _computeClamp(el) {
      var M = 14;
      var sceneEl = root.querySelector('.as-scene');
      var sceneRect = sceneEl ? sceneEl.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };

      var baseLeft = parseFloat(el.style.left) || 0;
      var baseTop = parseFloat(el.style.top) || 0;
      var baseW = parseInt(el.dataset.baseW, 10) || 142;

      var rect = el.getBoundingClientRect();
      var expandedH = Math.max(rect.height, baseW + 80);

      var tx = 0;
      var ty = 0;

      var sceneH = sceneRect.height;
      var sceneW = sceneRect.width;

      var spaceBelow = sceneH - baseTop - M;
      var spaceAbove = baseTop - M;

      if (expandedH > spaceBelow && spaceAbove > spaceBelow) {
        ty = -(expandedH - baseW);
        if (baseTop + ty < M) ty = M - baseTop;
      } else {
        if (baseTop + expandedH > sceneH - M) {
          ty = (sceneH - M) - (baseTop + expandedH);
        }
        if (baseTop + ty < M) ty = M - baseTop;
      }

      var cardRight = baseLeft + baseW;
      if (cardRight > sceneW - M) {
        tx = (sceneW - M) - cardRight;
      }
      if (baseLeft + tx < M) {
        tx = M - baseLeft;
      }

      return { tx: tx, ty: ty };
    }

    function smartPosition(el) {
      var c = _computeClamp(el);
      gsap.to(el, { x: c.tx, y: c.ty, duration: 0.5, ease: 'power2.out', overwrite: true });
    }

    function clearSmartPosition(el) {
      gsap.to(el, { x: 0, y: 0, duration: 0.6, ease: 'power2.inOut', overwrite: true });
    }

    // ===== Orbit init =====
    function initOrbit() {
      var sceneEl = root.querySelector('.as-scene');
      var W = sceneEl ? sceneEl.clientWidth : window.innerWidth;
      var H = sceneEl ? sceneEl.clientHeight : window.innerHeight;

      var entries = projects.map(function (proj) {
        var el = createCard(proj);
        stage.appendChild(el);
        el.addEventListener('click', function () { openModal(proj.id); });
        var baseW = parseInt(el.dataset.baseW, 10);
        return { el: el, proj: proj, baseW: baseW };
      });

      var maxHalf = Math.max.apply(null, entries.map(function (e) { return e.baseW; })) / 2;
      var margin = 16;
      var rx = Math.max(W / 2 - maxHalf - margin, 300);
      var ry = Math.max(H / 2 - maxHalf - margin, 300);
      var cx = W / 2;
      var cy = H / 2;

      arcTable = buildArcTable(rx, ry);
      var phases = computeEvenArcPhases(arcTable, entries.length);

      entries.forEach(function (entry, i) {
        cardData.push({
          el: entry.el, arcPhase: phases[i], rx: rx, ry: ry,
          cx: cx, cy: cy, id: entry.proj.id, baseW: entry.baseW
        });
        cardEls.push(entry.el);
      });

      cardEls.forEach(function (el) {
        el.addEventListener('mouseenter', function () {
          orbitRunning = false;
          hoveredId = parseInt(el.dataset.id, 10);
          gsap.killTweensOf(el);
          smartPosition(el);
          repel(hoveredId);
        });
        el.addEventListener('mouseleave', function () {
          orbitRunning = true;
          hoveredId = null;
          clearSmartPosition(el);
          restoreAll();
        });
      });

      lastTime = performance.now();
      requestAnimationFrame(tick);
    }

    function tick(now) {
      var targetSpeed = orbitRunning ? SPEED : 0;
      currentSpeed += (targetSpeed - currentSpeed) * SPEED_LERP;
      if (Math.abs(currentSpeed) < 0.0001) currentSpeed = 0;

      var dt = (now - lastTime) / 1000;
      lastTime = now;
      if (dt > 0 && dt < 0.2 && arcTable) {
        var arcRate = arcTable.total / (2 * Math.PI);
        globalArc += currentSpeed * arcRate * dt;
      }

      updatePositions();
      requestAnimationFrame(tick);
    }

    function repel(hId) {
      if (!arcTable) return;
      var hIdx = -1;
      for (var i = 0; i < cardData.length; i++) {
        if (cardData[i].id === hId) { hIdx = i; break; }
      }
      if (hIdx === -1) return;
      var angle = angleAtArc(arcTable, cardData[hIdx].arcPhase + globalArc);
      var hx = cardData[hIdx].cx + cardData[hIdx].rx * Math.cos(angle);
      var hy = cardData[hIdx].cy + cardData[hIdx].ry * Math.sin(angle);

      cardData.forEach(function (cd) {
        if (cd.id === hId) return;
        var a = angleAtArc(arcTable, cd.arcPhase + globalArc);
        var x = cd.cx + cd.rx * Math.cos(a);
        var y = cd.cy + cd.ry * Math.sin(a);
        var dx = x - hx, dy = y - hy;
        var dist = Math.sqrt(dx * dx + dy * dy) || 1;
        var strength = Math.max(0, 1 - dist / 500) * 55;
        var ox = (dx / dist) * strength;
        var oy = (dy / dist) * strength;
        gsap.to(cd.el, { x: ox, y: oy, duration: 1.0, ease: 'power3.out', overwrite: 'auto' });
      });
    }

    function restoreAll() {
      cardData.forEach(function (cd) {
        gsap.to(cd.el, { x: 0, y: 0, duration: 1.4, ease: 'power2.inOut', overwrite: 'auto' });
      });
    }

    // ===== Modal =====
    function openModal(id) {
      currentProjectId = id;

      // Body scroll lock — applied only while modal is open, removed on close
      savedScrollY = window.scrollY;
      document.body.style.top = '-' + savedScrollY + 'px';
      document.body.classList.add('as-modal-open');

      modalContentWrap.classList.remove('as-visible', 'as-switching');
      renderModal(id);

      modalOverlay.classList.add('as-active');
      orbitRunning = false;

      requestAnimationFrame(function () {
        modalOverlay.classList.add('as-open');
        requestAnimationFrame(function () { modalContentWrap.classList.add('as-visible'); });
      });
    }

    function closeModal() {
      modalOverlay.classList.remove('as-open');

      document.body.classList.remove('as-modal-open');
      document.body.style.top = '';
      window.scrollTo(0, savedScrollY);

      stopAudio();
      orbitRunning = true;

      setTimeout(function () { modalOverlay.classList.remove('as-active'); }, 350);
    }

    function renderModal(id) {
      var p = projects[id];
      currentTrackIndex = 0;

      modalTitle.textContent = p.title;
      modalTags.innerHTML = makeTagsHTML(p.tags);
      modalBy.innerHTML = makeByHTML(p.by);

      var modalArtContainer = modalOverlay.querySelector('.as-modal-body');
      var oldSvg = modalOverlay.querySelector('.as-modal-art-svg');
      if (oldSvg) oldSvg.remove();

      if (p.image) {
        modalArt.style.display = 'block';
        modalArt.src = p.image;
      } else {
        modalArt.style.display = 'none';
        var svgWrap = document.createElement('div');
        svgWrap.className = 'as-modal-art-svg';
        svgWrap.innerHTML = makeSVGart(p.gradient, 200, 200);
        modalArtContainer.prepend(svgWrap);
      }

      loadTrack(id, 0);
    }

    function loadTrack(projId, trackIdx) {
      var p = projects[projId];
      var trackTitle, trackUrl;

      if (Array.isArray(p.audio) && p.audio.length > 0) {
        var track = p.audio[trackIdx];
        trackTitle = track.title;
        trackUrl = track.url;
        prevTrackBtn.style.opacity = trackIdx > 0 ? '1' : '0.25';
        prevTrackBtn.disabled = !(trackIdx > 0);
        nextTrackBtn.style.opacity = trackIdx < p.audio.length - 1 ? '1' : '0.25';
        nextTrackBtn.disabled = !(trackIdx < p.audio.length - 1);
      } else {
        trackTitle = p.artist + ' — preview';
        trackUrl = typeof p.audio === 'string' ? p.audio : '';
        prevTrackBtn.style.opacity = '0.3';
        nextTrackBtn.style.opacity = '0.3';
      }

      modalTrackLabel.textContent = trackTitle;

      stopAudio();
      if (trackUrl) audio.src = trackUrl;
      playerBar.style.width = '0%';
    }

    function stopAudio() {
      audio.pause();
      audio.currentTime = 0;
      isPlaying = false;
      clearInterval(progressInterval);
      setPlayBtn(false);
    }

    function togglePlay() {
      if (!audio.src || audio.src === window.location.href) return;
      if (isPlaying) {
        audio.pause();
      } else {
        audio.play().catch(function () {});
      }
    }

    function setPlayBtn(playing) {
      playBtn.innerHTML = playing
        ? '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>'
        : '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="8,5 19,12 8,19"/></svg>';
    }

    function updateProgress() {
      if (!audio.duration) return;
      var pct = (audio.currentTime / audio.duration) * 100;
      playerBar.style.width = pct + '%';
    }

    function switchProject(newId) {
      modalContentWrap.classList.add('as-switching');
      modalContentWrap.classList.remove('as-visible');
      stopAudio();
      setTimeout(function () {
        currentProjectId = newId;
        renderModal(newId);
        modalContentWrap.classList.remove('as-switching');
        modalOverlay.scrollTop = 0;
        requestAnimationFrame(function () { modalContentWrap.classList.add('as-visible'); });
      }, 250);
    }

    // ===== Audio events =====
    audio.addEventListener('ended', function () {
      var p = projects[currentProjectId];
      if (Array.isArray(p.audio) && currentTrackIndex < p.audio.length - 1) {
        currentTrackIndex++;
        loadTrack(currentProjectId, currentTrackIndex);
        audio.play().catch(function () {});
        return;
      }
      isPlaying = false;
      clearInterval(progressInterval);
      setPlayBtn(false);
      playerBar.style.width = '0%';
    });

    audio.addEventListener('play', function () {
      isPlaying = true;
      setPlayBtn(true);
      clearInterval(progressInterval);
      progressInterval = setInterval(updateProgress, 200);
    });

    audio.addEventListener('pause', function () {
      isPlaying = false;
      setPlayBtn(false);
      clearInterval(progressInterval);
    });

    // Click on progress bar
    playerBar.parentElement.addEventListener('click', function (e) {
      if (!audio.duration) return;
      var rect = e.currentTarget.getBoundingClientRect();
      var ratio = (e.clientX - rect.left) / rect.width;
      audio.currentTime = ratio * audio.duration;
      updateProgress();
    });

    playBtn.addEventListener('click', togglePlay);

    nextTrackBtn.addEventListener('click', function () {
      var p = projects[currentProjectId];
      if (Array.isArray(p.audio) && currentTrackIndex < p.audio.length - 1) {
        currentTrackIndex++;
        loadTrack(currentProjectId, currentTrackIndex);
        audio.play();
      }
    });

    prevTrackBtn.addEventListener('click', function () {
      if (currentTrackIndex > 0) {
        currentTrackIndex--;
        loadTrack(currentProjectId, currentTrackIndex);
        audio.play();
      }
    });

    modalPrev.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      switchProject((currentProjectId - 1 + projects.length) % projects.length);
    });
    modalNext.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      switchProject((currentProjectId + 1) % projects.length);
    });

    modalClose.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', function (e) {
      if (e.target === e.currentTarget) closeModal();
    });

    document.addEventListener('keydown', function (e) {
      if (!modalOverlay.classList.contains('as-open')) return;
      if (e.key === 'ArrowRight') {
        if (e.shiftKey) modalNext.click(); else nextTrackBtn.click();
      }
      if (e.key === 'ArrowLeft') {
        if (e.shiftKey) modalPrev.click(); else prevTrackBtn.click();
      }
    });

    // ===== Mobile slider =====
    function initMobile() {
      var wrapper = document.getElementById('as-swiperWrapper');
      var mobilePrev = document.getElementById('as-mobilePrev');
      var mobileNext = document.getElementById('as-mobileNext');
      var mobileIndex = 0;

      projects.forEach(function (proj) {
        var slide = document.createElement('div');
        slide.className = 'as-mobile-slide';
        slide.innerHTML =
          '<div class="as-mobile-slide-art">' +
            (proj.image
              ? '<img src="' + proj.image + '" alt="' + proj.title + '">'
              : makeSVGart(proj.gradient, 250, 250)) +
          '</div>' +
          '<div class="as-mobile-slide-info">' +
            '<div class="as-mobile-slide-title">' + proj.title + '</div>' +
            '<div class="as-mobile-slide-tags">' + makeTagsHTML(proj.tags) + '</div>' +
          '</div>';
        slide.addEventListener('click', function () { openModal(proj.id); });
        wrapper.appendChild(slide);
      });

      function showSlide(idx, animate) {
        mobileIndex = idx;
        var slides = wrapper.querySelectorAll('.as-mobile-slide');
        slides.forEach(function (s, i) {
          s.classList.remove('as-active', 'as-animate');
          if (i === idx) {
            s.classList.add('as-active');
            if (animate) {
              void s.offsetWidth;
              requestAnimationFrame(function () { s.classList.add('as-animate'); });
            } else {
              s.classList.add('as-animate');
            }
          }
        });
        mobilePrev.style.opacity = idx > 0 ? '1' : '0.35';
        mobileNext.style.opacity = idx < projects.length - 1 ? '1' : '0.35';
      }

      showSlide(0, false);

      mobilePrev.addEventListener('click', function () {
        if (mobileIndex > 0) showSlide(mobileIndex - 1, true);
      });
      mobileNext.addEventListener('click', function () {
        if (mobileIndex < projects.length - 1) showSlide(mobileIndex + 1, true);
      });

      var touchStartX = 0;
      wrapper.addEventListener('touchstart', function (e) {
        touchStartX = e.touches[0].clientX;
      });
      wrapper.addEventListener('touchend', function (e) {
        var dx = e.changedTouches[0].clientX - touchStartX;
        if (dx > 50 && mobileIndex > 0) showSlide(mobileIndex - 1, true);
        if (dx < -50 && mobileIndex < projects.length - 1) showSlide(mobileIndex + 1, true);
      });
    }

    // ===== Resize =====
    function handleResize() {
      var sceneEl = root.querySelector('.as-scene');
      var W = sceneEl ? sceneEl.clientWidth : window.innerWidth;
      var H = sceneEl ? sceneEl.clientHeight : window.innerHeight;

      var maxHalf = cardData.length
        ? Math.max.apply(null, cardData.map(function (cd) { return cd.baseW; })) / 2
        : 0;
      var margin = 16;
      var rx = Math.max(W / 2 - maxHalf - margin, 300);
      var ry = Math.max(H / 2 - maxHalf - margin, 300);

      var cx = W / 2;
      var cy = H / 2;

      var oldTotal = arcTable ? arcTable.total : null;
      arcTable = buildArcTable(rx, ry);
      if (oldTotal) globalArc = (globalArc / oldTotal) * arcTable.total;

      var phases = computeEvenArcPhases(arcTable, cardData.length);

      cardData.forEach(function (cd, i) {
        cd.rx = rx;
        cd.ry = ry;
        cd.cx = cx;
        cd.cy = cy;
        cd.arcPhase = phases[i];
      });
    }
    window.addEventListener('resize', handleResize);

    // ===== Mouse tracking (no body.focus hack — that broke Webflow page) =====
    document.addEventListener('mousemove', function (e) {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });

    // Wheel only over studio-title — scoped to section, does not block page scroll elsewhere
    document.addEventListener('wheel', function (e) {
      if (modalOverlay.classList.contains('as-open')) return;
      if (!studioTitle) return;

      var rect = studioTitle.getBoundingClientRect();
      var overText =
        mouseX >= rect.left && mouseX <= rect.right &&
        mouseY >= rect.top && mouseY <= rect.bottom;

      if (overText && arcTable) {
        e.preventDefault();
        var arcRate = arcTable.total / (2 * Math.PI);
        globalArc += e.deltaY * 0.003 * arcRate;
      }
    }, { passive: false });

    // ===== Fetch and boot =====
    var query = '*[_type == "project"]{' +
      '"id": _id, title, artist, tags, size, colors,' +
      '"image": image.asset->url,' +
      '"by": by[]->{name, initials, color, "avatarUrl": avatar.asset->url},' +
      '"audio": audioTracks[]{"title": trackTitle, "url": file.asset->url}' +
    '}';

    client.fetch(query).then(function (data) {
      projects = data.map(function (p, index) {
        return Object.assign({}, p, {
          id: index,
          gradient: p.colors || ['#c45f3a', '#8b2e12']
        });
      });
      initOrbit();
      initMobile();
    }).catch(function (err) {
      console.error('Sanity load error:', err);
    });
  }

  // Boot — wait for DOM + libs
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { waitForLibs(init); });
  } else {
    waitForLibs(init);
  }
})();
