let lockCount = 0
let mainPrevOverflow = ''
let mainScrollTop = 0

const SCROLL_LOCK_CLASS = 'modal-scroll-locked'

function getMainEl() {
  return document.querySelector<HTMLElement>('.app-main, main.app-main, .app-shell main')
}

function isInsideOpenModal(target: EventTarget | null) {
  if (!(target instanceof Node)) return false
  return !!document.querySelector('.app-modal-overlay')?.contains(target)
}

function preventBackgroundScroll(event: Event) {
  if (isInsideOpenModal(event.target)) return
  event.preventDefault()
}

export function lockModalScroll() {
  if (typeof document === 'undefined') return
  if (lockCount === 0) {
    document.documentElement.classList.add(SCROLL_LOCK_CLASS)
    document.body.classList.add(SCROLL_LOCK_CLASS)

    const main = getMainEl()
    if (main) {
      mainScrollTop = main.scrollTop
      mainPrevOverflow = main.style.overflow
      main.style.overflow = 'hidden'
    }

    document.addEventListener('wheel', preventBackgroundScroll, { passive: false, capture: true })
    document.addEventListener('touchmove', preventBackgroundScroll, { passive: false, capture: true })
  }
  lockCount++
}

export function unlockModalScroll() {
  if (typeof document === 'undefined') return
  if (lockCount <= 0) return
  lockCount--
  if (lockCount === 0) {
    document.removeEventListener('wheel', preventBackgroundScroll, { capture: true })
    document.removeEventListener('touchmove', preventBackgroundScroll, { capture: true })

    document.documentElement.classList.remove(SCROLL_LOCK_CLASS)
    document.body.classList.remove(SCROLL_LOCK_CLASS)

    const main = getMainEl()
    if (main) {
      main.style.overflow = mainPrevOverflow
      main.scrollTop = mainScrollTop
      mainPrevOverflow = ''
      mainScrollTop = 0
    }
  }
}
