import { ImageResponse } from 'next/og'

export const size = {
  width: 180,
  height: 180,
}

export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: 'center',
          background: '#0E1320',
          borderRadius: 36,
          display: 'flex',
          height: '100%',
          justifyContent: 'center',
          position: 'relative',
          width: '100%',
        }}
      >
        <div
          style={{
            background: '#151C2B',
            border: '4px solid #243042',
            borderRadius: 30,
            display: 'flex',
            gap: -6,
            padding: '18px 16px',
          }}
        >
          <span
            style={{
              color: '#62D48C',
              fontSize: 86,
              fontStyle: 'italic',
              fontWeight: 900,
              letterSpacing: '-0.08em',
              lineHeight: 1,
            }}
          >
            G
          </span>
          <span
            style={{
              color: '#F5F7FB',
              fontSize: 86,
              fontStyle: 'italic',
              fontWeight: 900,
              letterSpacing: '-0.08em',
              lineHeight: 1,
            }}
          >
            G
          </span>
        </div>
      </div>
    ),
    size
  )
}
