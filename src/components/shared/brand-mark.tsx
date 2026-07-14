import Image from "next/image";

export function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <span className="brand-mark" style={{ height: size, width: size }}>
      <Image alt="" height={size} priority src="/brand/niagaai-ledger-signal.png" width={size} />
    </span>
  );
}

export function BrandWordmark({ size = 34 }: { size?: number }) {
  const width = Math.round(size * (1624 / 459));

  return (
    <span aria-label="NiagaAI" className="brand-wordmark">
      <Image alt="" height={size} priority src="/brand/niagaai-lockup.png" width={width} />
    </span>
  );
}
