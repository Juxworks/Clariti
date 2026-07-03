/* ================================================
   CLARITI — Scroll-Driven Canvas Experience
   Frame-based rendering (240 WebP frames @ 30fps)
   Hero: canvas visible from load, scroll = advance frames
   ================================================ */

'use strict';

/* global Lenis, gsap, ScrollTrigger */

// ── Constants ──────────────────────────────────────────────────────────────
const FRAME_COUNT    = 240;
const FRAME_SPEED    = 1.5;   // animation completes at ~67% scroll — smoother scrub on the short track
const IMAGE_SCALE    = 1.0;   // full-bleed cover — artwork fills the viewport
const DARK_ENTER     = 0.11;  // Selected Works range (10–30%)
const DARK_LEAVE     = 0.27;
const MARQUEE_ENTER  = 0.25;
const MARQUEE_LEAVE  = 0.75;
const FADE_RANGE     = 0.03;

const frames     = new Array(FRAME_COUNT);
let   bgColor    = '#0f0f0f';
let   currentFrame = 0;
let   canvas, ctx;
let   lenis;      // Lenis instance — shared so anchor nav can smooth-scroll

// ── Frame path helper ──────────────────────────────────────────────────────
function framePath(i) {
    return `frames/frame_${String(i).padStart(4, '0')}.webp`;
}

// ── Sample background colour from frame edge pixels ────────────────────────
function sampleBgColor(img) {
    const tmp = document.createElement('canvas');
    tmp.width  = 4;
    tmp.height = 4;
    const tc = tmp.getContext('2d');
    tc.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, 0, 0, 4, 4);
    const d = tc.getImageData(0, 0, 1, 1).data;
    bgColor = `rgb(${d[0]},${d[1]},${d[2]})`;
}

// ── Canvas draw ────────────────────────────────────────────────────────────
function drawFrame(index) {
    const img = frames[index];
    if (!img || !img.complete) return;
    const cw = canvas.width  / (window.devicePixelRatio || 1);
    const ch = canvas.height / (window.devicePixelRatio || 1);
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const scale = Math.max(cw / iw, ch / ih) * IMAGE_SCALE;
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = (cw - dw) / 2;
    const dy = (ch - dh) / 2;
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(img, dx, dy, dw, dh);
}

function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = window.innerWidth  * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.scale(dpr, dpr);
    drawFrame(currentFrame);
}

// ── Module 1: Frame Preloader ──────────────────────────────────────────────
function initLoader() {
    const loader  = document.getElementById('loader');
    const barFill = document.getElementById('loader-bar-fill');
    const pctEl   = document.getElementById('loader-percent');

    canvas = document.getElementById('canvas');
    ctx    = canvas.getContext('2d');
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    let loaded = 0;

    function onLoad(i) {
        loaded++;
        // Sample bg from frame 0 for seamless border fill
        if (i === 1) sampleBgColor(frames[0]);
        // Sample every 20 frames to track bg colour changes
        if (i % 20 === 0) sampleBgColor(frames[i - 1]);
        const pct = loaded / FRAME_COUNT;
        barFill.style.width = (pct * 100) + '%';
        pctEl.textContent   = Math.round(pct * 100) + '%';
        // Draw as frames arrive for live preview in loader
        if (i - 1 === currentFrame) drawFrame(currentFrame);
        if (loaded === FRAME_COUNT) {
            // All frames ready — hide loader
            barFill.style.width = '100%';
            pctEl.textContent   = '100%';
            setTimeout(() => {
                loader.classList.add('hidden');
                init();
            }, 300);
        }
    }

    // Phase 1: load first 10 frames immediately for fast first paint
    for (let i = 1; i <= Math.min(10, FRAME_COUNT); i++) {
        const img = new Image();
        img.onload = () => onLoad(i);
        img.onerror = () => onLoad(i); // count even on error
        img.src = framePath(i);
        frames[i - 1] = img;
    }

    // Phase 2: load remaining frames in background
    for (let i = 11; i <= FRAME_COUNT; i++) {
        const img = new Image();
        img.onload = () => onLoad(i);
        img.onerror = () => onLoad(i);
        img.src = framePath(i);
        frames[i - 1] = img;
    }
}

// ── Module 2: Frame-to-scroll binding ─────────────────────────────────────
function initScrollScrub() {
    const sc = document.getElementById('scroll-container');

    ScrollTrigger.create({
        trigger: sc,
        start:   'top top',
        end:     'bottom bottom',
        scrub:   true,
        onUpdate: (self) => {
            const accelerated = Math.min(self.progress * FRAME_SPEED, 1);
            const index = Math.min(
                Math.floor(accelerated * FRAME_COUNT),
                FRAME_COUNT - 1
            );
            if (index !== currentFrame) {
                currentFrame = index;
                requestAnimationFrame(() => drawFrame(currentFrame));
            }
        }
    });
}

// ── Module 3: Lenis smooth scroll ─────────────────────────────────────────
function initLenis() {
    lenis = new Lenis({
        duration:        1.2,
        easing:          (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel:     true,
        wheelMultiplier: 1.35,  // each wheel tick travels further — snappier section-to-section
    });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
}

// ── Module 3b: Anchor navigation ───────────────────────────────────────────
// Sections are pinned overlays, so a native #jump lands at the knife-edge of
// a section's visibility range (or outside it). Instead, scroll to the
// midpoint of the section's enter→leave range, where it is always centred.
function initAnchorNav() {
    const sc = document.getElementById('scroll-container');

    document.querySelectorAll('a[href^="#"]').forEach(a => {
        a.addEventListener('click', (e) => {
            const target = document.querySelector(a.getAttribute('href'));
            if (!target) return;
            const section = target.closest('.scroll-section');
            if (!section || !section.dataset.enter) return;

            e.preventDefault();
            const enter = parseFloat(section.dataset.enter) / 100;
            const leave = parseFloat(section.dataset.leave) / 100;
            const mid   = (enter + leave) / 2;
            const span  = sc.offsetHeight - window.innerHeight;
            const dest  = mid * span;

            if (lenis) lenis.scrollTo(dest, { duration: 1.6 });
            else       window.scrollTo({ top: dest, behavior: 'smooth' });
        });
    });
}

// ── Module 4: Hero scroll effects ──────────────────────────────────────────
function initHeroScroll() {
    const hero        = document.getElementById('hero');
    const heroLogo    = document.getElementById('hero-logo');
    const headerLogo  = document.querySelector('.site-header .logo');
    const sc          = document.getElementById('scroll-container');

    ScrollTrigger.create({
        trigger: sc,
        start:   'top top',
        end:     'bottom bottom',
        scrub:   true,
        onUpdate: (self) => {
            const p = self.progress;
            const fade = Math.max(0, 1 - p / 0.08);
            hero.style.opacity       = fade;
            hero.style.pointerEvents = fade < 0.05 ? 'none' : '';
            heroLogo.style.opacity   = fade * 0.55;
            // Header logo fades in as hero fades out (crossfade between p=0.06 and p=0.10)
            headerLogo.style.opacity = Math.max(0, Math.min(1, (p - 0.06) / 0.04));
        }
    });
}

// ── Module 5: Section animation system ────────────────────────────────────
function initSectionAnimations() {
    const sc = document.getElementById('scroll-container');

    document.querySelectorAll('.scroll-section').forEach(section => {
        const type    = section.dataset.animation;
        const persist = section.dataset.persist === 'true';
        const enter   = parseFloat(section.dataset.enter) / 100;
        const leave   = parseFloat(section.dataset.leave) / 100;

        const children = section.querySelectorAll(
            '.section-label, .section-heading, .section-subheading, .section-body, ' +
            '.contact-block, .stat, .service-list li, .work-list li'
        );
        if (!children.length) return;

        const tl = gsap.timeline({ paused: true });

        switch (type) {
            case 'slide-left':
                tl.from(children, { x: -80, opacity: 0, stagger: 0.14, duration: 0.9, ease: 'power3.out' });
                break;
            case 'slide-right':
                tl.from(children, { x: 80,  opacity: 0, stagger: 0.14, duration: 0.9, ease: 'power3.out' });
                break;
            case 'scale-up':
                tl.from(children, { scale: 0.85, opacity: 0, stagger: 0.12, duration: 1.0, ease: 'power2.out' });
                break;
            case 'stagger-up':
                tl.from(children, { y: 60,  opacity: 0, stagger: 0.15, duration: 0.8, ease: 'power3.out' });
                break;
            case 'clip-reveal':
                tl.from(children, { clipPath: 'inset(100% 0 0 0)', opacity: 0, stagger: 0.15, duration: 1.2, ease: 'power4.inOut' });
                break;
            case 'rotate-in':
                tl.from(children, { y: 40, rotation: 3, opacity: 0, stagger: 0.10, duration: 0.9, ease: 'power3.out' });
                break;
        }

        let wasVisible = false;

        function show() {
            if (wasVisible) return;
            wasVisible = true;
            section.classList.add('is-visible');
            gsap.to(section, { opacity: 1, duration: 0.45, ease: 'power2.out' });
            tl.play();
        }
        function hide() {
            if (!wasVisible) return;
            wasVisible = false;
            gsap.to(section, { opacity: 0, duration: 0.35, ease: 'power2.in',
                onComplete: () => section.classList.remove('is-visible') });
            tl.reverse();
        }

        // Pin: counter scroll drift so content stays viewport-centred across
        // its whole enter→leave range instead of only at the range midpoint.
        const mid = (enter + leave) / 2;

        ScrollTrigger.create({
            trigger: sc,
            start:   'top top',
            end:     'bottom bottom',
            onUpdate: (self) => {
                const p = self.progress;
                const span    = sc.offsetHeight - window.innerHeight;
                const clamped = Math.min(Math.max(p, enter), leave);
                gsap.set(section, { yPercent: -50, y: (clamped - mid) * span });
                const inRange = p >= enter && p < leave;
                if (inRange)                              show();
                else if (!inRange && wasVisible && !persist) hide();
                else if (p >= leave && persist)           show();
            }
        });
    });
}

// ── Module 6: Counter animations ──────────────────────────────────────────
function initCounters() {
    document.querySelectorAll('.stat-number').forEach(el => {
        const target   = parseFloat(el.dataset.value);
        const decimals = parseInt(el.dataset.decimals || '0');
        gsap.fromTo(el,
            { textContent: 0 },
            {
                textContent: target,
                duration:    2.2,
                ease:        'power1.out',
                snap:        { textContent: decimals === 0 ? 1 : 0.1 },
                scrollTrigger: {
                    trigger:       el.closest('.scroll-section'),
                    start:         'top 70%',
                    toggleActions: 'play none none reverse',
                },
                onUpdate() {
                    const v = parseFloat(gsap.getProperty(el, 'textContent'));
                    el.textContent = decimals === 0 ? Math.round(v).toString() : v.toFixed(decimals);
                }
            }
        );
    });
}

// ── Module 7: Mountain Scene (Three.js generative landscape) ──────────────
function initMountainScene() {
    const container = document.getElementById('mountain-scene');
    if (!container || typeof THREE === 'undefined') return;

    const isMobile = window.innerWidth < 768;
    const segments = isMobile ? 48 : 128;

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
        75, container.clientWidth / container.clientHeight, 0.1, 100
    );
    camera.position.set(0, 1.5, 3);
    camera.rotation.x = -0.3;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const geometry = new THREE.PlaneGeometry(12, 8, segments, segments);

    const vertexShader = `
        uniform float time;
        varying vec3 vNormal;
        varying vec3 vPosition;
        vec3 mod289v3(vec3 x){return x-floor(x*(1./289.))*289.;}
        vec4 mod289v4(vec4 x){return x-floor(x*(1./289.))*289.;}
        vec4 permute(vec4 x){return mod289v4(((x*34.)+1.)*x);}
        vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
        float snoise(vec3 v){
            const vec2 C=vec2(1./6.,1./3.);
            const vec4 D=vec4(0.,.5,1.,2.);
            vec3 i=floor(v+dot(v,C.yyy));
            vec3 x0=v-i+dot(i,C.xxx);
            vec3 g=step(x0.yzx,x0.xyz);
            vec3 l=1.-g;
            vec3 i1=min(g.xyz,l.zxy);
            vec3 i2=max(g.xyz,l.zxy);
            vec3 x1=x0-i1+C.xxx;
            vec3 x2=x0-i2+C.yyy;
            vec3 x3=x0-D.yyy;
            i=mod289v3(i);
            vec4 p=permute(permute(permute(
                i.z+vec4(0.,i1.z,i2.z,1.))
                +i.y+vec4(0.,i1.y,i2.y,1.))
                +i.x+vec4(0.,i1.x,i2.x,1.));
            float n_=0.142857142857;
            vec3 ns=n_*D.wyz-D.xzx;
            vec4 j=p-49.*floor(p*ns.z*ns.z);
            vec4 x_=floor(j*ns.z);
            vec4 y_=floor(j-7.*x_);
            vec4 x=x_*ns.x+ns.yyyy;
            vec4 y=y_*ns.x+ns.yyyy;
            vec4 h=1.-abs(x)-abs(y);
            vec4 b0=vec4(x.xy,y.xy);
            vec4 b1=vec4(x.zw,y.zw);
            vec4 s0=floor(b0)*2.+1.;
            vec4 s1=floor(b1)*2.+1.;
            vec4 sh=-step(h,vec4(0.));
            vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
            vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
            vec3 p0=vec3(a0.xy,h.x);
            vec3 p1=vec3(a0.zw,h.y);
            vec3 p2=vec3(a1.xy,h.z);
            vec3 p3=vec3(a1.zw,h.w);
            vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
            p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
            vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);
            m=m*m;
            return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
        }
        void main(){
            vNormal=normal;
            vPosition=position;
            float f=0.8,a=0.6;
            float d=snoise(vec3(position.x*f,position.y*f-time*.2,0.))*a;
            d+=snoise(vec3(position.x*f*2.,position.y*f*2.-time*.2,0.))*(a*.5);
            gl_Position=projectionMatrix*modelViewMatrix*vec4(position+normal*d,1.);
        }
    `;

    const fragmentShader = `
        uniform vec3 color;
        uniform vec3 pointLightPosition;
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main(){
            vec3 n=normalize(vNormal);
            vec3 l=normalize(pointLightPosition-vPosition);
            float diff=max(dot(n,l),0.);
            float fres=pow(1.-dot(n,vec3(0.,0.,1.)),2.);
            gl_FragColor=vec4(color*diff+color*fres*.5,1.);
        }
    `;

    const material = new THREE.ShaderMaterial({
        side: THREE.DoubleSide,
        wireframe: false,
        uniforms: {
            time:               { value: 0 },
            pointLightPosition: { value: new THREE.Vector3(0, 0, 5) },
            color:              { value: new THREE.Color('#a5cdd2') },
        },
        vertexShader,
        fragmentShader,
        transparent: true,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    scene.add(mesh);

    const pointLight = new THREE.PointLight(0xffffff, 1, 100);
    pointLight.position.set(0, 0, 5);
    scene.add(pointLight);

    // Only render when footer is visible — saves GPU when scrolled away
    let footerVisible = false;
    new IntersectionObserver(
        ([entry]) => { footerVisible = entry.isIntersecting; },
        { threshold: 0 }
    ).observe(container);

    const animateMountain = (t) => {
        if (footerVisible) {
            material.uniforms.time.value = t * 0.0003;
            renderer.render(scene, camera);
        }
        requestAnimationFrame(animateMountain);
    };
    requestAnimationFrame(animateMountain);

    window.addEventListener('resize', () => {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    });

    window.addEventListener('mousemove', (e) => {
        const x = (e.clientX / window.innerWidth) * 2 - 1;
        const y = -(e.clientY / window.innerHeight) * 2 + 1;
        const pos = new THREE.Vector3(x * 5, 2, 2 - y * 2);
        pointLight.position.copy(pos);
        if (material.uniforms.pointLightPosition) {
            material.uniforms.pointLightPosition.value = pos;
        }
    });
}

// ── Module 8: Background audio ────────────────────────────────────────────
function initAudio() {
    const audio = document.getElementById('bg-audio');
    const btn   = document.getElementById('sound-toggle');
    if (!audio || !btn) return;

    audio.volume = 0;  // start silent; fade in after play starts

    // Fade volume in smoothly over ~2 s
    function fadeIn() {
        const target = 0.35;
        const step   = () => {
            if (audio.volume < target) {
                audio.volume = Math.min(audio.volume + 0.01, target);
                setTimeout(step, 60);
            }
        };
        step();
    }

    let started = false;

    function startAudio() {
        if (started) return;
        audio.play().then(() => {
            started = true;
            fadeIn();
            btn.classList.remove('is-muted');
        }).catch(() => { /* autoplay still blocked — button click will trigger */ });
    }

    // Attempt play on first scroll or click (satisfies browser autoplay policy)
    const onInteract = () => {
        startAudio();
        window.removeEventListener('scroll', onInteract);
        window.removeEventListener('pointerdown', onInteract);
    };
    window.addEventListener('scroll', onInteract, { once: true });
    window.addEventListener('pointerdown', onInteract, { once: true });

    // Also try immediately (works if user has previously interacted with the domain)
    startAudio();

    // Toggle button: mute / unmute
    btn.addEventListener('click', () => {
        if (!started) {
            // Button press counts as an interaction — start and unmute
            startAudio();
            return;
        }
        audio.muted = !audio.muted;
        btn.classList.toggle('is-muted', audio.muted);
        btn.setAttribute('aria-label', audio.muted ? 'Unmute audio' : 'Mute audio');
    });

    // Initial aria state
    btn.setAttribute('aria-label', 'Mute audio');
}

// ── Module 9: Dark overlay ─────────────────────────────────────────────────
function initDarkOverlay() {
    const overlay = document.getElementById('dark-overlay');
    const sc      = document.getElementById('scroll-container');
    const de = DARK_ENTER - FADE_RANGE, df = DARK_ENTER;
    const dl = DARK_LEAVE, do_ = DARK_LEAVE + FADE_RANGE;

    ScrollTrigger.create({
        trigger: sc, start: 'top top', end: 'bottom bottom', scrub: true,
        onUpdate: (self) => {
            const p = self.progress;
            let o = 0;
            if      (p >= de  && p < df)   o = (p - de) / FADE_RANGE;
            else if (p >= df  && p <= dl)   o = 0.9;
            else if (p > dl   && p <= do_)  o = 0.9 * (1 - (p - dl) / FADE_RANGE);
            overlay.style.opacity = o;
        }
    });
}

// ── Module 9: Cloud mouse trail ────────────────────────────────────────────
function initCloudTrail() {
    const cc    = document.getElementById('cloud-canvas');
    const cctx  = cc.getContext('2d');
    const dpr   = window.devicePixelRatio || 1;
    const puffs = [];

    function resizeCloud() {
        cc.width  = window.innerWidth  * dpr;
        cc.height = window.innerHeight * dpr;
        cctx.scale(dpr, dpr);
    }
    resizeCloud();
    window.addEventListener('resize', resizeCloud);

    // Spawn a cluster of puffs at (x, y)
    function spawnPuff(x, y) {
        const count = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < count; i++) {
            puffs.push({
                x:    x + (Math.random() - 0.5) * 28,
                y:    y + (Math.random() - 0.5) * 18,
                r:    14 + Math.random() * 22,       // radius
                vx:   (Math.random() - 0.5) * 0.6,  // drift
                vy:   -0.4 - Math.random() * 0.5,   // rise
                life: 1.0,
                decay: 0.008 + Math.random() * 0.008,
            });
        }
    }

    // Throttle spawning to ~60 px minimum movement
    let lastX = -999, lastY = -999;
    window.addEventListener('mousemove', (e) => {
        const dx = e.clientX - lastX, dy = e.clientY - lastY;
        if (dx * dx + dy * dy < 900) return; // 30px threshold
        lastX = e.clientX;
        lastY = e.clientY;
        spawnPuff(e.clientX, e.clientY);
    });

    // Draw a single cloud puff using overlapping radial gradients
    function drawPuff(p) {
        const a = p.life * 0.22;
        const g = cctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        g.addColorStop(0,   `rgba(220,235,245,${a})`);
        g.addColorStop(0.5, `rgba(200,220,235,${a * 0.6})`);
        g.addColorStop(1,   `rgba(180,210,230,0)`);
        cctx.fillStyle = g;
        cctx.beginPath();
        cctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        cctx.fill();
    }

    function loopCloud() {
        cctx.clearRect(0, 0, cc.width / dpr, cc.height / dpr);
        for (let i = puffs.length - 1; i >= 0; i--) {
            const p = puffs[i];
            p.x    += p.vx;
            p.y    += p.vy;
            p.r    += 0.35;   // expand as it rises
            p.life -= p.decay;
            if (p.life <= 0) { puffs.splice(i, 1); continue; }
            drawPuff(p);
        }
        requestAnimationFrame(loopCloud);
    }
    loopCloud();
}

// ── init() — called once all frames are loaded ─────────────────────────────
function init() {
    gsap.registerPlugin(ScrollTrigger);

    initLenis();          // must come first
    initAnchorNav();
    initScrollScrub();
    initHeroScroll();
    initSectionAnimations();
    initCounters();
    initMountainScene();
    initAudio();
    initDarkOverlay();
    initCloudTrail();

    drawFrame(0);         // paint frame 0 immediately

    // ── Hero entrance ──────────────────────────────────────────────────────
    gsap.from('.hero-line', {
        opacity: 0, y: 48,
        stagger: 0.14, duration: 1.2, ease: 'power3.out', delay: 0.25
    });
    gsap.from('.scroll-indicator', {
        opacity: 0, y: 12, duration: 0.9, ease: 'power3.out', delay: 1.0
    });
}

// ── Bootstrap ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initLoader(); // starts loading frames, calls init() when done
});
