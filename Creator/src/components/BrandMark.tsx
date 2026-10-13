/** The StyleMint mark (downscaled from the mobile app's branding asset). */
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}mark-192.png`}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      style={{
        flexShrink: 0,
        display: 'block',
        borderRadius: size * 0.23,
        background: '#fff',
        boxShadow: '0 3px 12px rgba(8, 61, 42, 0.18)',
      }}
    />
  );
}
