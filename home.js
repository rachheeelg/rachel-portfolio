/*
 * Opening sequence for rachheeelg.work
 *
 * 1. "Rachel Goh" scrambles in the centre (1s)
 * 2. Splits: "Rachel" slides to the left edge, "Goh" to the right (1s)
 * 3. Four thin tiles slide up into view, staggered
 * 4. Page scroll is held. ONE scroll / swipe / ↓ / space then plays the reveal:
 *    tiles expand into a full-width row and scatter into the final layout,
 *    while Rachel / Goh slide off the edges
 * 5. Scroll is released (for any content you add below the opening later)
 */
;(() => {
  // ---------------- Settings (tweak here) ----------------
  const CONFIG = {
    // Text scramble — same character set and 120ms speed as the Baffle.js
    // CodePen (Rahulive/WNQgvbV), rewritten without the library.
    // That pen reveals over 4000ms; here it's 1000ms to keep the intro snappy.
    shuffleDuration: 1000,
    shuffleHold: 200, // all symbols before letters start settling
    shuffleTick: 120,
    symbols: Array.from("█▓█ ▒░/▒░ █░▒▓/ █▒▒ ▓▒▓/█ ░█▒/ ▒▓░ █<░▒ ▓/░>"),

    // Centre → sides hand-off
    splitDuration: 1000,
    splitEasing: "cubic-bezier(0.76, 0, 0.24, 1)",

    // Tile slide-up
    imageDelays: [0, 150, 300, 450],
    imageDuration: 850,
    imageEasing: "cubic-bezier(0.22, 1, 0.36, 1)",

    // Starting thumbnails (thin strips in a centred row)
    startWidth: 120,
    startHeight: 14,
    startGap: 13,

    // Scroll-triggered reveal
    revealDuration: 1600,
    expandEnd: 0.6, // expansion runs 0 → 60% of the reveal
    scatterStart: 0.4, // scatter runs 40% → 100%
    sideOffset: 24, // how far past the edge Rachel / Goh travel

    // Final layout (fractions of the screen, from the 1512 × 982 reference)
    margin: 0.045,
    gap: 0.0145,
    rowWidth: 0.91,
    tileAspect: 183 / 326,
    scatterTops: [603 / 982, 399 / 982, 601 / 982, 184 / 982],

    // Input
    wheelThreshold: 4,
    touchThreshold: 30,
    quietMs: 250, // waits for trackpad momentum to stop before unlocking
  }

  // ---------------- Elements ----------------
  const scene = document.getElementById("scene")
  const center = document.getElementById("name-center")
  const left = document.getElementById("name-left")
  const right = document.getElementById("name-right")
  const masks = Array.from(scene.querySelectorAll(".mask"))
  const tiles = masks.map((m) => m.querySelector(".tile"))

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches

  // Always start the page at the top so the intro plays from the beginning
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
  let progress = reducedMotion ? 1 : 0
  let gateOpen = false
  let pendingTrigger = false
  let animStart = 0
  let rafId = null
  let quietId = null
  let touchStartY = null
  const side = { measured: false, left: 0, right: 0 }

  // ---------------- Layout ----------------
  function layout(p) {
    const W = scene.clientWidth
    const H = scene.clientHeight
    const n = masks.length

    const expansion = easeInOutCubic(p / CONFIG.expandEnd)
    const scatter = easeInOutCubic(
      (p - CONFIG.scatterStart) / (1 - CONFIG.scatterStart)
    )

    // Start: thin strips centred on the screen
    const startTotal = n * CONFIG.startWidth + (n - 1) * CONFIG.startGap
    const startX = (W - startTotal) / 2
    const startTop = H / 2 - CONFIG.startHeight / 2

    // Expanded row + scattered final positions
    const margin = W * CONFIG.margin
    const gap = W * CONFIG.gap
    const targetW = (W * CONFIG.rowWidth - gap * (n - 1)) / n
    const targetH = targetW * CONFIG.tileAspect
    const rowTop = H / 2 - targetH / 2

    masks.forEach((mask, i) => {
      const startLeft = startX + i * (CONFIG.startWidth + CONFIG.startGap)
      const targetLeft = margin + i * (targetW + gap)
      const expandedTop = lerp(startTop, rowTop, expansion)
      const scatterTop = (CONFIG.scatterTops[i] ?? 0.5) * H
      const top = lerp(expandedTop, scatterTop, scatter)

      mask.style.left = `${lerp(startLeft, targetLeft, expansion)}px`
      mask.style.top = `${top}px`
      mask.style.width = `${lerp(CONFIG.startWidth, targetW, expansion)}px`
      mask.style.height = `${lerp(CONFIG.startHeight, targetH, expansion)}px`
    })

    // Rachel / Goh slide off during the first part of the expansion
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

  // ---------------- 1. Scramble ----------------
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
      const p = clamp01((elapsed - CONFIG.shuffleHold) / revealSpan)
      render(Math.floor(p * order.length))
    }, CONFIG.shuffleTick)

    setTimeout(() => {
      clearInterval(interval)
      el.textContent = original
      onDone()
    }, CONFIG.shuffleDuration)
  }

  // Bounding boxes of the first and last word inside the centred text
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

  // ---------------- 2. Hand-off to the sides ----------------
  function handoff() {
    const words = getWordRects(center)
    center.style.visibility = "hidden"
    left.style.visibility = "visible"
    right.style.visibility = "visible"

    if (words && typeof left.animate === "function") {
      const l = left.getBoundingClientRect()
      const r = right.getBoundingClientRect()
      const opts = {
        duration: CONFIG.splitDuration,
        easing: CONFIG.splitEasing,
        fill: "both",
      }
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

  // ---------------- 3. Tiles slide up ----------------
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

    // Once the last tile has landed, the scroll trigger becomes active
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
      if (pendingTrigger) startReveal()
    }
  }

  // ---------------- 4. One-shot reveal ----------------
  function startReveal() {
    if (phase !== "ready") return
    phase = "animating"
    animStart = performance.now()
    rafId = requestAnimationFrame(tick)
  }

  function tick(now) {
    rafId = null
    progress = clamp01((now - animStart) / CONFIG.revealDuration)
    layout(progress)
    if (progress < 1) {
      rafId = requestAnimationFrame(tick)
    } else {
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

  // ---------------- Input: hold scroll until the reveal is done ----------------
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
      if (phase === "settling") return scheduleRelease() // swallow momentum
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

  // Catches scrollbar dragging while locked
  window.addEventListener(
    "scroll",
    () => {
      if (phase !== "done" && window.scrollY !== 0) window.scrollTo(0, 0)
    },
    { passive: true }
  )

  window.addEventListener("resize", () => {
    if (gateOpen) measureSides()
    layout(progress)
  })

  // ---------------- Start ----------------
  layout(progress)

  if (reducedMotion) {
    // No motion: show the final layout straight away, no scroll lock
    center.style.visibility = "hidden"
    left.style.visibility = "visible"
    right.style.visibility = "visible"
    tiles.forEach((t) => (t.style.visibility = "visible"))
    gateOpen = true
    measureSides()
    layout(progress)
    return
  }

  // Wait for the web font so word positions are measured correctly
  const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve()
  fontsReady.then(() => scramble(center, handoff))
})()