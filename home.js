/*
 * Home page for rachheeelg.work
 *
 * 1. "Rachel Goh" glitches in the centre
 * 2. Splits: "Rachel" slides to the left edge, "Goh" to the right
 * 3. Four thin strips slide up into view
 * 4. Page scroll is held. ONE scroll / swipe / ↓ / space plays the reveal:
 *    the strips expand and scatter into place, Rachel / Goh slide off
 * 5. The work grid takes over: the 4 opener images become grid tiles,
 *    the rest of the work eases in around them
 * 6. Scrolling moves the columns in alternating directions (up, down, up, down)
 *
 * Phones (< 700px) and reduced-motion users get a simple 2/4-column grid
 * that scrolls normally.
 */
;(() => {
  // ---------------- Settings (tweak here) ----------------
  const CONFIG = {
    // Text glitch — same characters and 120ms speed as the Baffle.js CodePen
    shuffleDuration: 1000,
    shuffleHold: 200,
    shuffleTick: 120,
    symbols: Array.from("█▓█ ▒░/▒░ █░▒▓/ █▒▒ ▓▒▓/█ ░█▒/ ▒▓░ █<░▒ ▓/░>"),

    // Centre → sides hand-off
    splitDuration: 1000,
    splitEasing: "cubic-bezier(0.76, 0, 0.24, 1)",

    // Strip slide-up
    imageDelays: [0, 150, 300, 450],
    imageDuration: 850,
    imageEasing: "cubic-bezier(0.22, 1, 0.36, 1)",

    // Starting strips (shrink automatically on narrow screens)
    startWidth: 120,
    startHeight: 14,
    startGap: 13,

    // Scroll-triggered reveal
    revealDuration: 1600,
    autoRevealDelay: 600, // pause (ms) after the strips land, then the reveal plays by itself
    expandEnd: 0.6,
    scatterStart: 0.4,
    sideOffset: 24,

    // Where the 4 opener images land (fractions of the screen, from the 1512 × 982 reference)
    margin: 0.045,
    gap: 0.0145,
    rowWidth: 0.91,
    tileAspect: 183 / 326,
    scatterTops: [603 / 982, 399 / 982, 601 / 982, 184 / 982],

    // Work grid
    mobileBreakpoint: 700, // below this: simple grid, normal scrolling
    repeatColumns: true, // repeats each column's work so columns never run out while moving
    columnSmoothing: 0.12, // 0–1. Lower = floatier, 1 = locked to the scrollbar

    // Input
    wheelThreshold: 4,
    touchThreshold: 30,
    quietMs: 250,
  }

  // ---------------- Elements ----------------
  const track = document.getElementById("track")
  const scene = document.getElementById("scene")
  const center = document.getElementById("name-center")
  const left = document.getElementById("name-left")
  const right = document.getElementById("name-right")
  const masks = Array.from(scene.querySelectorAll(".mask"))
  const tiles = masks.map((m) => m.querySelector(".tile"))
  const cols = Array.from(document.querySelectorAll("#work .col"))

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  const isStaticMode = () => reducedMotion || window.innerWidth < CONFIG.mobileBreakpoint

  if ("scrollRestoration" in history) history.scrollRestoration = "manual"
  window.scrollTo(0, 0)

  // ---------------- Helpers ----------------
  const clamp01 = (v) => Math.max(0, Math.min(1, v))
  const lerp = (a, b, t) => a + (b - a) * t
  const easeInOutCubic = (v) => {
    const t = clamp01(v)
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
  }
  const randomSymbol = () =>
    CONFIG.symbols[Math.floor(Math.random() * CONFIG.symbols.length)]

  // ---------------- State ----------------
  // intro → ready → animating → settling → done
  let phase = reducedMotion ? "done" : "intro"
  let progress = 0
  let gateOpen = false
  let pendingTrigger = false
  let animStart = 0
  let quietId = null
  let touchStartY = null
  let live = false
  let staticOn = false
  let clonesBuilt = false
  const side = { measured: false, left: 0, right: 0 }

  // ================= OPENER =================

  function layout(p) {
    const W = scene.clientWidth
    const H = scene.clientHeight
    const n = masks.length

    const expansion = easeInOutCubic(p / CONFIG.expandEnd)
    const scatter = easeInOutCubic(
      (p - CONFIG.scatterStart) / (1 - CONFIG.scatterStart)
    )

    // Start: thin strips centred on screen, narrower on small screens
    const startW = Math.min(
      CONFIG.startWidth,
      (W * 0.8 - (n - 1) * CONFIG.startGap) / n
    )
    const startTotal = n * startW + (n - 1) * CONFIG.startGap
    const startX = (W - startTotal) / 2
    const startTop = H / 2 - CONFIG.startHeight / 2

    // Expanded row + scattered final positions
    const margin = W * CONFIG.margin
    const gap = W * CONFIG.gap
    const targetW = (W * CONFIG.rowWidth - gap * (n - 1)) / n
    const targetH = targetW * CONFIG.tileAspect
    const rowTop = H / 2 - targetH / 2

    // The grid uses the same numbers, so the opener images land exactly on their tiles
    scene.style.setProperty("--work-pad", `${margin}px`)
    scene.style.setProperty("--work-gap", `${gap}px`)

    masks.forEach((mask, i) => {
      const startLeft = startX + i * (startW + CONFIG.startGap)
      const targetLeft = margin + i * (targetW + gap)
      const expandedTop = lerp(startTop, rowTop, expansion)
      const scatterTop = (CONFIG.scatterTops[i] ?? 0.5) * H
      const top = lerp(expandedTop, scatterTop, scatter)

      mask.style.left = `${lerp(startLeft, targetLeft, expansion)}px`
      mask.style.top = `${top}px`
      mask.style.width = `${lerp(startW, targetW, expansion)}px`
      mask.style.height = `${lerp(CONFIG.startHeight, targetH, expansion)}px`
    })

    if (side.measured) {
      const sideP = clamp01(expansion / 0.4)
      left.style.translate = `${side.left * sideP}px 0px`
      right.style.translate = `${side.right * sideP}px 0px`
    }
  }

  function measureSides() {
    const sceneRect = scene.getBoundingClientRect()
    const prevL = left.style.translate
    const prevR = right.style.translate
    left.style.translate = ""
    right.style.translate = ""
    const l = left.getBoundingClientRect()
    const r = right.getBoundingClientRect()
    side.left = -CONFIG.sideOffset - (l.right - sceneRect.left)
    side.right = sceneRect.width + CONFIG.sideOffset - (r.left - sceneRect.left)
    left.style.translate = prevL
    right.style.translate = prevR
    side.measured = true
  }

  // 1. Glitch
  function scramble(el, onDone) {
    const original = el.textContent
    const chars = Array.from(original)
    const order = chars
      .map((c, i) => (/\s/.test(c) ? -1 : i))
      .filter((i) => i >= 0)
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[order[i], order[j]] = [order[j], order[i]]
    }

    const render = (settledCount) => {
      const settled = new Set(order.slice(0, settledCount))
      el.textContent = chars
        .map((c, i) => (/\s/.test(c) || settled.has(i) ? c : randomSymbol()))
        .join("")
    }

    const start = performance.now()
    const revealSpan = CONFIG.shuffleDuration - CONFIG.shuffleHold
    render(0)
    const interval = setInterval(() => {
      const elapsed = performance.now() - start
      const t = clamp01((elapsed - CONFIG.shuffleHold) / revealSpan)
      render(Math.floor(t * order.length))
    }, CONFIG.shuffleTick)

    setTimeout(() => {
      clearInterval(interval)
      el.textContent = original
      onDone()
    }, CONFIG.shuffleDuration)
  }

  function getWordRects(el) {
    const node = el.firstChild
    if (!node || node.nodeType !== Node.TEXT_NODE) return null
    const words = Array.from(node.nodeValue.matchAll(/\S+/g))
    if (words.length === 0) return null
    const rectOf = (m) => {
      const range = document.createRange()
      range.setStart(node, m.index)
      range.setEnd(node, m.index + m[0].length)
      return range.getBoundingClientRect()
    }
    return { first: rectOf(words[0]), last: rectOf(words[words.length - 1]) }
  }

  // 2. Split to the sides
  function handoff() {
    const words = getWordRects(center)
    center.style.visibility = "hidden"
    left.style.visibility = "visible"
    right.style.visibility = "visible"

    if (words && typeof left.animate === "function") {
      const l = left.getBoundingClientRect()
      const r = right.getBoundingClientRect()
      const opts = { duration: CONFIG.splitDuration, easing: CONFIG.splitEasing, fill: "both" }
      left.animate(
        [
          { transform: `translate(${words.first.left - l.left}px, ${words.first.top - l.top}px)` },
          { transform: "translate(0px, 0px)" },
        ],
        opts
      )
      right.animate(
        [
          { transform: `translate(${words.last.left - r.left}px, ${words.last.top - r.top}px)` },
          { transform: "translate(0px, 0px)" },
        ],
        opts
      )
    }

    revealTiles(performance.now() + CONFIG.splitDuration)
  }

  // 3. Strips slide up
  function revealTiles(startTime) {
    tiles.forEach((tile, i) => {
      const delay = Math.max(0, startTime + CONFIG.imageDelays[i] - performance.now())
      setTimeout(() => {
        tile.style.visibility = "visible"
        if (typeof tile.animate === "function") {
          tile.animate(
            [{ transform: "translateY(105%)" }, { transform: "translateY(0%)" }],
            { duration: CONFIG.imageDuration, easing: CONFIG.imageEasing, fill: "both" }
          )
        }
      }, delay)
    })

    const lastDelay = Math.max(...CONFIG.imageDelays)
    const gateIn = startTime + lastDelay + CONFIG.imageDuration - performance.now()
    setTimeout(openGate, Math.max(0, gateIn))
  }

  function openGate() {
    gateOpen = true
    measureSides()
    layout(progress)
    if (phase === "intro") {
      phase = "ready"
      setTimeout(startReveal, pendingTrigger ? 0 : CONFIG.autoRevealDelay)
    }
  }

  // 4. One-shot reveal
  function startReveal() {
    if (phase !== "ready") return
    phase = "animating"

    // Phones: fade the opener out and show the simple grid
    if (isStaticMode()) {
      track.classList.add("is-leaving")
      setTimeout(() => {
        progress = 1
        enterStatic()
        phase = "settling"
        scheduleRelease()
      }, 400)
      return
    }

    animStart = performance.now()
    requestAnimationFrame(tick)
  }

  function tick(now) {
    progress = clamp01((now - animStart) / CONFIG.revealDuration)
    layout(progress)
    if (progress < 1) {
      requestAnimationFrame(tick)
    } else {
      goLive()
      phase = "settling"
      scheduleRelease()
    }
  }

  function scheduleRelease() {
    clearTimeout(quietId)
    quietId = setTimeout(() => {
      phase = "done"
    }, CONFIG.quietMs)
  }

  function trigger() {
    if (phase === "intro") pendingTrigger = true
    else if (phase === "ready") startReveal()
  }

  // ================= WORK GRID =================

  const colState = cols.map((el) => ({
    el,
    dir: el.dataset.direction === "down" ? 1 : -1, // down = +1, up = -1
    base: 0,
    travel: 0,
  }))
  let scrollDistance = 0
  let colTarget = 0
  let colCurrent = 0
  let colRaf = null

  // Stagger index for the ease-in
  function numberTiles() {
    document.querySelectorAll("#work .work-tile").forEach((tile, i) => {
      tile.style.setProperty("--i", i % 12)
    })
  }

  // Repeat each column's work so a moving column never shows a gap.
  // Down columns get the copy above, up columns below.
  function buildClones() {
    if (clonesBuilt || !CONFIG.repeatColumns) return
    clonesBuilt = true
    colState.forEach(({ el, dir }) => {
      const originals = Array.from(el.children)
      const copies = originals.map((tile) => {
        const copy = tile.cloneNode(true)
        copy.classList.add("is-clone")
        copy.removeAttribute("data-anchor")
        copy.setAttribute("aria-hidden", "true")
        copy.querySelectorAll("img").forEach((img) => (img.alt = ""))
        copy.querySelectorAll("video").forEach((v) => {
          v.removeAttribute("aria-label")
          v.preload = "none" // copies only load when they scroll into view
        })
        return copy
      })
      if (dir === 1) copies.reverse().forEach((c) => el.prepend(c))
      else copies.forEach((c) => el.append(c))
    })
    numberTiles()
    watchVideos()
  }

  // Position each column so its anchor tile sits exactly where the opener image landed,
  // then work out how far each column can travel without running out of work.
  function computeColumns() {
    const H = scene.clientHeight
    colState.forEach((c, colIndex) => {
      const anchor = c.el.querySelector("[data-anchor]")
      const anchorIndex = anchor ? Number(anchor.dataset.anchor) - 1 : colIndex
      const landTop = (CONFIG.scatterTops[anchorIndex] ?? 0.5) * H
      c.base = anchor ? landTop - anchor.offsetTop : 0
      const height = c.el.offsetHeight
      c.travel =
        c.dir === 1
          ? Math.max(0, -c.base) // room above
          : Math.max(0, c.base + height - H) // room below
    })
    scrollDistance = Math.max(0, ...colState.map((c) => c.travel))
    track.style.height = `${H + scrollDistance}px`
    colTarget = scrollProgress()
    colCurrent = colTarget
    applyColumns(colCurrent)
  }

  function applyColumns(p) {
    colState.forEach((c) => {
      c.el.style.transform = `translate3d(0, ${c.base + c.dir * c.travel * p}px, 0)`
    })
  }

  function scrollProgress() {
    return scrollDistance > 0 ? clamp01(window.scrollY / scrollDistance) : 0
  }

  function columnLoop() {
    colRaf = null
    colCurrent = lerp(colCurrent, colTarget, CONFIG.columnSmoothing)
    if (Math.abs(colTarget - colCurrent) < 0.0005) colCurrent = colTarget
    applyColumns(colCurrent)
    if (colCurrent !== colTarget) colRaf = requestAnimationFrame(columnLoop)
  }

  function onColumnScroll() {
    if (!live || staticOn) return
    colTarget = scrollProgress()
    if (colRaf === null) colRaf = requestAnimationFrame(columnLoop)
  }

  // Desktop hand-off: opener images → grid tiles, rest eases in
  function goLive() {
    buildClones()
    computeColumns()
    live = true
    track.classList.add("is-live")
  }

  // Phones / reduced motion: plain grid, normal page scrolling
  function enterStatic() {
    staticOn = true
    live = true
    track.style.height = ""
    colState.forEach((c) => (c.el.style.transform = ""))
    track.classList.add("is-static", "is-live")
    window.scrollTo(0, 0)
  }

  function exitStatic() {
    staticOn = false
    track.classList.remove("is-static", "is-leaving")
    layout(1)
    buildClones()
    computeColumns()
  }

  // Videos play only while on screen (saves battery and data)
  let videoObserver = null
  function watchVideos() {
    const videos = document.querySelectorAll("#work video")
    if (reducedMotion) {
      videos.forEach((v) => (v.controls = true))
      return
    }
    if (!("IntersectionObserver" in window)) {
      videos.forEach((v) => v.play().catch(() => {}))
      return
    }
    if (!videoObserver) {
      videoObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const v = entry.target
            if (entry.isIntersecting && live) v.play().catch(() => {})
            else v.pause()
          })
        },
        { threshold: 0.4 } // only play when mostly on screen
      )
    }
    videos.forEach((v) => videoObserver.observe(v))
  }

  // Re-check videos once the grid becomes visible
  const liveObserver = new MutationObserver(() => {
    if (track.classList.contains("is-live")) {
      liveObserver.disconnect()
      watchVideos()
    }
  })
  liveObserver.observe(track, { attributes: true, attributeFilter: ["class"] })

  // ================= INPUT =================

  const DOWN_KEYS = ["ArrowDown", "PageDown", " ", "Spacebar", "End"]
  const SCROLL_KEYS = [...DOWN_KEYS, "ArrowUp", "PageUp", "Home"]

  function isEditable(target) {
    if (!target) return false
    const tag = target.tagName
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable
  }

  window.addEventListener(
    "wheel",
    (e) => {
      if (phase === "done") return
      e.preventDefault()
      if (phase === "settling") return scheduleRelease()
      if (e.deltaY > CONFIG.wheelThreshold) trigger()
    },
    { passive: false }
  )

  window.addEventListener(
    "touchstart",
    (e) => {
      touchStartY = e.touches[0]?.clientY ?? null
    },
    { passive: true }
  )

  window.addEventListener(
    "touchmove",
    (e) => {
      if (phase === "done") return
      e.preventDefault()
      if (phase === "settling" || touchStartY === null) return
      const y = e.touches[0]?.clientY ?? touchStartY
      if (touchStartY - y > CONFIG.touchThreshold) {
        touchStartY = null
        trigger()
      }
    },
    { passive: false }
  )

  window.addEventListener("keydown", (e) => {
    if (phase === "done" || isEditable(e.target)) return
    if (!SCROLL_KEYS.includes(e.key)) return
    e.preventDefault()
    if (phase !== "settling" && DOWN_KEYS.includes(e.key)) trigger()
  })

  window.addEventListener(
    "scroll",
    () => {
      if (phase !== "done" && window.scrollY !== 0) {
        window.scrollTo(0, 0)
        return
      }
      onColumnScroll()
    },
    { passive: true }
  )

  window.addEventListener("resize", () => {
    if (!live) {
      if (gateOpen) measureSides()
      layout(progress)
      return
    }
    const shouldBeStatic = isStaticMode()
    if (shouldBeStatic && !staticOn) enterStatic()
    else if (!shouldBeStatic && staticOn) exitStatic()
    else if (!staticOn) {
      layout(1)
      computeColumns()
    }
  })

  // When an image/video loads and changes a tile's height, re-measure the columns
  let recomputeRaf = null
  function scheduleRecompute() {
    if (!live || staticOn || recomputeRaf !== null) return
    recomputeRaf = requestAnimationFrame(() => {
      recomputeRaf = null
      computeColumns()
    })
  }
  const workEl = document.getElementById("work")
  workEl.addEventListener("load", scheduleRecompute, true)

  // Videos set to --ratio: auto take the video's real shape (and pass it to their repeats)
  workEl.addEventListener(
    "loadedmetadata",
    (e) => {
      const v = e.target
      if (v.tagName === "VIDEO" && v.videoWidth && v.videoHeight) {
        const ratio = `${v.videoWidth} / ${v.videoHeight}`
        const src = v.getAttribute("src")
        workEl.querySelectorAll("video").forEach((other) => {
          if (other.getAttribute("src") !== src) return
          const fig = other.closest(".work-tile")
          const wanted = fig && fig.dataset.autoRatio === "true"
          if (wanted) fig.style.setProperty("--ratio", ratio)
        })
      }
      scheduleRecompute()
    },
    true
  )

  // Remember which tiles asked for their own shape
  workEl.querySelectorAll(".work-tile").forEach((fig) => {
    if (fig.style.getPropertyValue("--ratio").trim() === "auto") fig.dataset.autoRatio = "true"
  })
  workEl.querySelectorAll("video").forEach((v) => {
    if (v.readyState >= 1) v.dispatchEvent(new Event("loadedmetadata"))
  })

  // ================= START =================

  // Decode images off the main thread so scrolling stays smooth
  document.querySelectorAll("img").forEach((img) => (img.decoding = "async"))
  numberTiles()
  layout(progress)

  if (reducedMotion) {
    // No motion: skip the opener, show the grid straight away
    progress = 1
    enterStatic()
    watchVideos()
    return
  }

  const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve()
  fontsReady.then(() => scramble(center, handoff))
})()