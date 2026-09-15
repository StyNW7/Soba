import { useId } from 'react'
import { cn } from '../../lib/cn'

export const bearCrops = {
  welcome: [10, 72, 540, 657],
  front: [548, 69, 169, 246],
  side: [725, 68, 134, 247],
  back: [873, 69, 176, 246],
  threeQuarter: [1068, 69, 165, 246],
  wave: [478, 402, 187, 252],
  love: [666, 413, 165, 242],
  excited: [843, 403, 209, 252],
  working: [1055, 443, 178, 205],
  reading: [232, 730, 198, 214],
  sleeping: [455, 740, 274, 203],
  thinking: [770, 713, 184, 231],
  walking: [1006, 703, 223, 245],
  neutral: [206, 1036, 139, 128],
  happy: [373, 1036, 145, 128],
  wink: [543, 1036, 144, 128],
  surprised: [708, 1036, 145, 128],
  sad: [874, 1036, 146, 128],
  cute: [1030, 1036, 185, 128],
} as const

export type BearPose = keyof typeof bearCrops

export function SobaBear({
  pose = 'wave',
  className,
}: {
  pose?: BearPose
  className?: string
}) {
  const id = useId()
  const [x, y, width, height] = bearCrops[pose]
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      data-bear-pose={pose}
      viewBox={`${x} ${y} ${width} ${height}`}
      width={width}
      height={height}
      className={cn(
        'pointer-events-none block h-auto shrink-0 overflow-hidden mix-blend-multiply',
        className,
      )}
    >
      <defs>
        <filter
          id={`${id}-paper`}
          colorInterpolationFilters="sRGB"
          x="0"
          y="0"
          width="100%"
          height="100%"
        >
          <feColorMatrix
            type="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  -1 -1 -1 0 2.82"
          />
        </filter>
        {pose === 'welcome' && (
          <clipPath id={id}>
            <path d="M10 72H530V255H550V395H472V729H10Z" />
          </clipPath>
        )}
        {pose === 'front' && (
          <clipPath id={id}>
            <path d="M548 69H717V315H560V250H548Z" />
          </clipPath>
        )}
      </defs>
      <image
        href="/images/mascot/pose-sheet.png"
        width="1254"
        height="1254"
        filter={`url(#${id}-paper)`}
        clipPath={
          pose === 'welcome' || pose === 'front' ? `url(#${id})` : undefined
        }
      />
    </svg>
  )
}
