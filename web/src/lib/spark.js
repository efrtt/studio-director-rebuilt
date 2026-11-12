// The Old School theme's click indicator, drawn rather than shipped.
//
// The game answers a click with a yellow X that grows and breaks apart. The sprites
// are Jagex's artwork and are not in this artefact, so the three frames are
// reproduced here as vector geometry, in the reference's proportions and its
// yellow-green.
//
// The sequence only ever grows outwards: a small X, then the largest solid X - as
// wide as the arms that follow it - and finally those arms thrown to the same outer
// extent. Every tip tapers to a blunt square point, so no bar ends in a hard corner:
// the crossed X's narrow towards themselves at each outer end, and the four arms of
// the last frame are short and narrow towards the centre, so it reads as open space
// with the points facing in. Then the sprite is gone.
//
// It is one string so the component and the style guide can draw the same thing:
// `ClickSpark.svelte` for a real press, the guide for a specimen. The frames are
// three groups; `osrs.css` shows them one at a time, 120ms each, cut rather than
// tweened.

export const SPARK_SVG = `
<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
  <g class="sd-spark-f1" fill="#e8f000">
    <g transform="rotate(45 16 16)"><path d="M9 15.4 L13.5 14.5 L18.5 14.5 L23 15.4 L23 16.6 L18.5 17.5 L13.5 17.5 L9 16.6 Z"/></g>
    <g transform="rotate(-45 16 16)"><path d="M9 15.4 L13.5 14.5 L18.5 14.5 L23 15.4 L23 16.6 L18.5 17.5 L13.5 17.5 L9 16.6 Z"/></g>
  </g>
  <g class="sd-spark-f2" fill="#e8f000">
    <g transform="rotate(45 16 16)"><path d="M1.6 15.4 L9.6 13.7 L22.4 13.7 L30.4 15.4 L30.4 16.6 L22.4 17.7 L9.6 17.7 L1.6 16.6 Z"/></g>
    <g transform="rotate(-45 16 16)"><path d="M1.6 15.4 L9.6 13.7 L22.4 13.7 L30.4 15.4 L30.4 16.6 L22.4 17.7 L9.6 17.7 L1.6 16.6 Z"/></g>
  </g>
  <g class="sd-spark-f3" fill="#e8f000">
    <g transform="rotate(45 16 16)">
      <path d="M1.6 14.2 L7.6 15.4 L7.6 16.6 L1.6 17.8 Z"/>
      <path d="M30.4 14.2 L24.4 15.4 L24.4 16.6 L30.4 17.8 Z"/>
    </g>
    <g transform="rotate(-45 16 16)">
      <path d="M1.6 14.2 L7.6 15.4 L7.6 16.6 L1.6 17.8 Z"/>
      <path d="M30.4 14.2 L24.4 15.4 L24.4 16.6 L30.4 17.8 Z"/>
    </g>
  </g>
</svg>
`;

export default SPARK_SVG;
