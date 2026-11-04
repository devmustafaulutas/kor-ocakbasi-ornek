/* Kor Ocakbaşı (hayali marka, UlvionTech örnek sitesi).
   Ağır animasyonlu site kalıbı: sayfa bütün görseller ve video inene kadar açılış ekranında bekler,
   sonra perde açılır, ateş WebGL ile çizilir, bölümler kaydırmaya bağlı hareket eder. */
(function () {
  'use strict';
  var t0 = performance.now();
  var MARK = (window.__kor = { start: performance.timeOrigin + t0 });
  var mobile = matchMedia('(max-width: 760px)').matches;

  // ---------- ember field: a dense random field precomputed up front, the way particle intros do ----------
  var FIELD = 90000;
  var field = new Float32Array(FIELD * 4);
  (function () {
    var s = 1234567;
    function rnd() { s = (s * 16807) % 2147483647; return s / 2147483647; }
    for (var i = 0; i < FIELD; i++) {
      var a = rnd() * Math.PI * 2, r = Math.pow(rnd(), 0.6);
      field[i * 4] = Math.cos(a) * r;
      field[i * 4 + 1] = rnd() * 2.4 - 1.2;
      field[i * 4 + 2] = 0.15 + rnd() * 0.85;
      field[i * 4 + 3] = rnd();
    }
    // smooth the field so neighbouring sparks drift together
    for (var pass = 0; pass < 6; pass++) {
      for (var j = 4; j < field.length - 4; j += 4) field[j] = (field[j - 4] + field[j] * 2 + field[j + 4]) / 4;
    }
  })();

  // ---------- WebGL fire: flames rise from the coals, sparks drift up ----------
  var fire = { i: 0 };
  var canvas = document.getElementById('ates');
  var renderer = null, scene, cam, mat, pts;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 1);
    scene = new THREE.Scene();
    cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);
    cam.position.z = 1;
    mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uI: { value: 0 }, uMouse: { value: new THREE.Vector2(0.5, 0.5) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: [
        'precision highp float;',
        'uniform float uTime; uniform vec2 uRes; uniform float uI; uniform vec2 uMouse; varying vec2 vUv;',
        'float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }',
        'float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);',
        '  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y); }',
        'float fbm(vec2 p){ float v = 0.0, a = 0.5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6); for (int i = 0; i < 7; i++){ v += a * noise(p); p = m * p; a *= 0.5; } return v; }',
        'void main(){',
        '  vec2 uv = vUv; float asp = uRes.x / uRes.y; vec2 p = vec2(uv.x * asp, uv.y); float t = uTime;',
        '  vec2 q = vec2(fbm(p * 1.8 + vec2(0.0, -t * 0.55)), fbm(p * 1.8 + vec2(5.2, -t * 0.7)));',
        '  vec2 r = vec2(fbm(p * 2.6 + q * 1.7 + vec2(1.7, -t * 1.3)), fbm(p * 2.6 + q * 1.7 + vec2(8.3, -t * 1.1)));',
        '  float f = fbm(p * 3.2 + r * 1.4 + vec2(0.0, -t * 1.9));',
        '  float h = 1.0 - uv.y;',
        '  float m = 1.0 - smoothstep(0.0, 0.35, distance(uv, uMouse)) * 0.25;',
        '  float flame = smoothstep(0.38, 1.0, f * (0.35 + h * 1.45) + h * h * 0.42) * uI * m;',
        '  vec3 col = mix(vec3(0.0), vec3(0.62, 0.08, 0.01), smoothstep(0.0, 0.3, flame));',
        '  col = mix(col, vec3(1.0, 0.36, 0.04), smoothstep(0.25, 0.62, flame));',
        '  col = mix(col, vec3(1.0, 0.8, 0.42), smoothstep(0.62, 1.0, flame));',
        '  col += vec3(0.35, 0.08, 0.0) * smoothstep(0.55, 1.0, h) * uI * 0.35;',
        '  gl_FragColor = vec4(col, 1.0);',
        '}'
      ].join('\n'),
      depthTest: false, depthWrite: false
    });
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));

    // sparks: a slice of the precomputed field, animated in the vertex shader
    var N = mobile ? 700 : 1400;
    var g = new THREE.BufferGeometry();
    var pos = new Float32Array(N * 3), seed = new Float32Array(N * 2);
    for (var k = 0; k < N; k++) {
      var b = (k * 61) % FIELD;
      pos[k * 3] = field[b * 4]; pos[k * 3 + 1] = field[b * 4 + 1]; pos[k * 3 + 2] = 0;
      seed[k * 2] = field[b * 4 + 2]; seed[k * 2 + 1] = field[b * 4 + 3];
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('seed', new THREE.BufferAttribute(seed, 2));
    var pmat = new THREE.ShaderMaterial({
      uniforms: { uTime: mat.uniforms.uTime, uI: mat.uniforms.uI, uPx: { value: renderer.getPixelRatio() } },
      vertexShader: [
        'attribute vec2 seed; uniform float uTime; uniform float uPx; varying float vA;',
        'void main(){',
        '  float sp = 0.18 + seed.x * 0.5; float y = mod(position.y + 1.2 + uTime * sp, 2.4) - 1.2;',
        '  float x = position.x * 1.1 + sin(uTime * (0.6 + seed.y) + seed.y * 30.0) * 0.06;',
        '  vA = (1.0 - smoothstep(0.2, 1.2, y)) * (0.4 + seed.y * 0.6);',
        '  gl_Position = vec4(x, y, 0.0, 1.0); gl_PointSize = (1.5 + seed.x * 4.0) * uPx;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'precision highp float; uniform float uI; varying float vA;',
        'void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * vA * uI;',
        '  gl_FragColor = vec4(vec3(1.0, 0.55, 0.18) * a + vec3(1.0, 0.9, 0.6) * a * a, 1.0); }'
      ].join('\n'),
      transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false
    });
    pts = new THREE.Points(g, pmat);
    scene.add(pts);
  } catch (e) {
    renderer = null;
  }

  function size() {
    if (!renderer) return;
    var w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    mat.uniforms.uRes.value.set(w, h);
  }
  size();
  addEventListener('resize', size);
  var mouse = { x: 0.5, y: 0.5 };
  function frame(now) {
    if (renderer) {
      mat.uniforms.uTime.value = now / 1000;
      mat.uniforms.uI.value = fire.i;
      mat.uniforms.uMouse.value.set(mouse.x, 1 - mouse.y);
      renderer.render(scene, cam);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ---------- preloader: the page waits until every image and the video are in ----------
  var num = document.getElementById('pl-num');
  var shown = { v: 0 };
  var imgs = Array.prototype.slice.call(document.images);
  var vid = document.querySelector('.hero-vid');
  var total = imgs.length + 1, loaded = 0, revealed = false;
  function bump() {
    loaded++;
    anime.remove(shown);
    anime({ targets: shown, v: Math.round(loaded / total * 100), round: 1, duration: 700, easing: 'easeOutQuad', update: function () { num.textContent = shown.v; } });
    if (loaded >= total) finish();
  }
  imgs.forEach(function (im) {
    if (im.complete && im.naturalWidth) bump();
    else { im.addEventListener('load', bump, { once: true }); im.addEventListener('error', bump, { once: true }); }
  });
  if (vid.readyState >= 4) bump();
  else { vid.addEventListener('canplaythrough', bump, { once: true }); vid.addEventListener('error', bump, { once: true }); }
  // never hold the visitor longer than 40 s
  setTimeout(finish, 40000);

  function finish() {
    if (revealed) return;
    revealed = true;
    MARK.loaded = performance.timeOrigin + performance.now();
    var wait = Math.max(0, 1700 - (performance.now() - t0));
    anime.remove(shown);
    anime({ targets: shown, v: 100, round: 1, duration: Math.max(300, wait), easing: 'easeOutQuad', update: function () { num.textContent = shown.v; } });
    setTimeout(reveal, wait + 250);
  }

  // ---------- the opening ----------
  gsap.registerPlugin(ScrollTrigger, SplitText);
  gsap.set('.hero-in .kick, .hero-in .sub, .hero-in .lead, .hero-in .cta .btn, .nav, .scroll-hint', { opacity: 0, y: 40 });
  var lenis = null;

  function reveal() {
    MARK.reveal = performance.timeOrigin + performance.now();
    document.body.classList.remove('is-loading');
    var tl = gsap.timeline();
    tl.to('.pl-in', { opacity: 0, scale: 0.92, duration: 0.35, ease: 'power2.in' })
      .to('.pl-half.top', { yPercent: -101, duration: 1.05, ease: 'expo.inOut' }, '-=0.05')
      .to('.pl-half.bot', { yPercent: 101, duration: 1.05, ease: 'expo.inOut' }, '<')
      .set('#preloader', { display: 'none' });
    gsap.fromTo('.hero-bg', { scale: 1.32 }, { scale: 1.06, duration: 2.8, ease: 'expo.out', delay: 0.25 });
    gsap.to(fire, { i: 1, duration: 1.8, ease: 'power2.out', delay: 0.4 });
    anime({ targets: '.title span', translateY: ['115%', '0%'], rotate: [10, 0], opacity: [0, 1], delay: anime.stagger(120, { start: 650 }), duration: 1600, easing: 'easeOutExpo' });
    gsap.to('.hero-in .kick, .hero-in .sub, .hero-in .lead, .hero-in .cta .btn', { opacity: 1, y: 0, duration: 1.2, stagger: 0.12, ease: 'expo.out', delay: 1.0 });
    gsap.to('.nav, .scroll-hint', { opacity: 1, y: 0, duration: 1.0, ease: 'expo.out', delay: 1.3 });
    var lead = new SplitText('.lead', { type: 'chars' });
    gsap.from(lead.chars, { opacity: 0, filter: 'blur(8px)', duration: 0.8, stagger: 0.018, ease: 'power2.out', delay: 1.2 });
    scrollScenes();
  }

  // ---------- scroll: smooth scrolling and layers tied to it ----------
  function scrollScenes() {
    lenis = new Lenis({ lerp: 0.075, wheelMultiplier: 0.9 });
    window.__lenis = lenis;
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);

    var hero = { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true };
    gsap.to('.hero-bg', { yPercent: 16, ease: 'none', scrollTrigger: hero });
    gsap.to('.hero-smoke', { yPercent: -30, xPercent: 6, ease: 'none', scrollTrigger: hero });
    gsap.to('.hero-in', { yPercent: -22, scale: 0.9, opacity: 0, ease: 'none', scrollTrigger: hero });
    gsap.to('.title', { letterSpacing: '0.12em', ease: 'none', scrollTrigger: hero });
    gsap.to('.band .track', { xPercent: -50, ease: 'none', scrollTrigger: { trigger: '.band', start: 'top bottom', end: 'bottom top', scrub: 1 } });

    gsap.timeline({ scrollTrigger: { trigger: '.ocak', start: 'top top', end: '+=120%', pin: '.ocak-pin', scrub: 1 } })
      .fromTo('.ocak-img', { clipPath: 'circle(14% at 50% 50%)' }, { clipPath: 'circle(78% at 50% 50%)', ease: 'none' })
      .fromTo('.ocak-img img', { scale: 1.45 }, { scale: 1, ease: 'none' }, 0)
      .from('.ocak-t span', { yPercent: 120, opacity: 0, stagger: 0.2, ease: 'power3.out' }, 0.25);

    gsap.utils.toArray('.card').forEach(function (c, i) {
      gsap.from(c, { y: 180, rotate: i % 2 ? 7 : -7, opacity: 0, duration: 1.3, ease: 'expo.out', scrollTrigger: { trigger: c, start: 'top 92%' } });
    });
    gsap.from('.sec-t', { yPercent: 60, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: '.menu', start: 'top 80%' } });

    var story = new SplitText('.hk-text', { type: 'words' });
    gsap.fromTo(story.words, { opacity: 0.1 }, { opacity: 1, stagger: 0.05, ease: 'none', scrollTrigger: { trigger: '.hikaye', start: 'top 70%', end: 'bottom 70%', scrub: true } });
    gsap.fromTo('.hk-bg', { scale: 1.3 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: '.hikaye', start: 'top bottom', end: 'bottom top', scrub: true } });
    gsap.from('.rez h2', { yPercent: 40, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: '.rez', start: 'top 75%' } });
  }

  // ---------- cursor glow and magnetic buttons ----------
  var cur = document.querySelector('.cursor');
  if (!mobile) {
    var qx = gsap.quickTo(cur, 'x', { duration: 0.45, ease: 'power3' });
    var qy = gsap.quickTo(cur, 'y', { duration: 0.45, ease: 'power3' });
    addEventListener('mousemove', function (e) {
      gsap.set(cur, { opacity: 1 });
      qx(e.clientX); qy(e.clientY);
      mouse.x = e.clientX / innerWidth; mouse.y = e.clientY / innerHeight;
    });
    document.querySelectorAll('.btn, .nav-cta').forEach(function (b) {
      b.addEventListener('mousemove', function (e) {
        var r = b.getBoundingClientRect();
        gsap.to(b, { x: (e.clientX - r.left - r.width / 2) * 0.3, y: (e.clientY - r.top - r.height / 2) * 0.4, duration: 0.5, ease: 'power3.out' });
      });
      b.addEventListener('mouseleave', function () { gsap.to(b, { x: 0, y: 0, duration: 0.8, ease: 'elastic.out(1, 0.4)' }); });
    });
  }
})();
