import { useId } from 'react'

/** 天琴 Lyra 品牌图形：暗夜底色上的星座线里拉琴与织女星 */
export default function LyraMark({ size = 34, tile = true }: { size?: number; tile?: boolean }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const tileId = `tile-${uid}`
  const haloId = `halo-${uid}`
  const goldId = `gold-${uid}`
  const starId = `star-${uid}`
  return (
    <svg width={size} height={size} viewBox="0 0 1024 1024" role="img" aria-label="天琴 Lyra">
      <defs>
        <linearGradient id={tileId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2b2d58" />
          <stop offset="0.55" stopColor="#1d1e3e" />
          <stop offset="1" stopColor="#131330" />
        </linearGradient>
        <radialGradient id={haloId} cx="0.5" cy="0.3" r="0.62">
          <stop offset="0" stopColor="#f7cf8b" stopOpacity="0.28" />
          <stop offset="0.55" stopColor="#f7cf8b" stopOpacity="0.07" />
          <stop offset="1" stopColor="#f7cf8b" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={goldId} gradientUnits="userSpaceOnUse" x1="0" y1="412" x2="0" y2="768">
          <stop offset="0" stopColor="#ffe9c2" />
          <stop offset="1" stopColor="#eec489" />
        </linearGradient>
        <linearGradient id={starId} gradientUnits="userSpaceOnUse" x1="0" y1="156" x2="0" y2="384">
          <stop offset="0" stopColor="#fff6df" />
          <stop offset="1" stopColor="#f5c977" />
        </linearGradient>
      </defs>
      {tile ? (
        <>
          <rect width="1024" height="1024" rx="232" fill={`url(#${tileId})`} />
          <rect width="1024" height="1024" rx="232" fill={`url(#${haloId})`} />
        </>
      ) : null}
      <path
        d="M512 156 C522 232 546 258 622 270 C546 282 522 308 512 384 C502 308 478 282 402 270 C478 258 502 232 512 156 Z"
        fill={`url(#${starId})`}
      />
      <circle cx="684" cy="216" r="9" fill="#f3d9a8" opacity="0.9" />
      <circle cx="352" cy="250" r="7" fill="#f3d9a8" opacity="0.75" />
      <circle cx="742" cy="330" r="6" fill="#f3d9a8" opacity="0.55" />
      <circle cx="286" cy="352" r="5" fill="#f3d9a8" opacity="0.5" />
      <g fill="none" stroke={`url(#${goldId})`} strokeLinecap="round">
        <path d="M446 714 C330 636 318 478 404 424" strokeWidth="27" />
        <path d="M578 714 C694 636 706 478 620 424" strokeWidth="27" />
        <path d="M394 418 H630" strokeWidth="25" />
        <path d="M454 436 V696" strokeWidth="11" opacity="0.92" />
        <path d="M493 436 V696" strokeWidth="11" />
        <path d="M531 436 V696" strokeWidth="11" />
        <path d="M570 436 V696" strokeWidth="11" opacity="0.92" />
      </g>
      <rect x="424" y="704" width="176" height="58" rx="29" fill={`url(#${goldId})`} />
    </svg>
  )
}
