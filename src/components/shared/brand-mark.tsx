import Image from "next/image";

export function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <span aria-hidden="true" className="brand-mark" style={{ height: size, width: size }}>
      <Image alt="" height={size} priority src="/brand/niagaai-flat-mark.svg" width={size} />
    </span>
  );
}

export function BrandWordmark() {
  return (
    <span aria-label="niaga" className="brand-wordmark">
      <BrandMark size={30} />
      <span aria-hidden="true" className="brand-wordmark-text">
        niaga<span className="brand-wordmark-dot">.</span>
      </span>
    </span>
  );
}
