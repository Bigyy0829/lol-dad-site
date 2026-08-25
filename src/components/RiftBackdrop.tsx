/**
 * Tier-B hand-built SVG — stylized Summoner's Rift line-art.
 * Decorative only (aria-hidden); strokes inherit currentColor so the
 * blueprint tint is controlled by CSS (--color-blue).
 */
export default function RiftBackdrop() {
  return (
    <div className="rift-stage" aria-hidden="true">
      <svg
        className="rift-svg"
        viewBox="0 0 1200 760"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      >
        {/* outer fortress walls */}
        <path d="M600 28 L1174 380 L600 732 L26 380 Z" />
        <path d="M600 80 L1098 380 L600 680 L102 380 Z" opacity="0.6" />

        {/* mid lane crossing */}
        <path d="M320 240 L880 520" opacity="0.5" />
        <path d="M880 240 L320 520" opacity="0.5" />

        {/* the river */}
        <path d="M250 200 C360 250 330 380 430 430 C520 475 470 590 570 640 C640 677 720 655 800 608" />

        {/* baron pit (top) */}
        <circle cx="870" cy="140" r="56" strokeDasharray="3 7" />
        <circle cx="870" cy="140" r="30" opacity="0.5" />

        {/* dragon pit (bottom) */}
        <circle cx="330" cy="620" r="52" strokeDasharray="3 7" />
        <circle cx="330" cy="620" r="28" opacity="0.5" />

        {/* brush / camp markers */}
        <circle cx="640" cy="300" r="7" opacity="0.55" />
        <circle cx="560" cy="460" r="7" opacity="0.55" />
        <circle cx="700" cy="560" r="7" opacity="0.55" />
        <circle cx="500" cy="210" r="7" opacity="0.55" />

        {/* base hexes */}
        <path d="M600 636 l13 7.5 0 15 -13 7.5 -13 -7.5 0 -15 Z" opacity="0.7" />
        <path d="M600 96 l13 7.5 0 15 -13 7.5 -13 -7.5 0 -15 Z" opacity="0.7" />
      </svg>
    </div>
  );
}
