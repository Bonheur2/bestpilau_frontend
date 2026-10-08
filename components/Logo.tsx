import Image from 'next/image';

export function Logo({ size = 64 }: { size?: number }) {
  return <Image src="/bestpilau.png" alt="Best Pilau" width={size} height={size} priority className="logo" />;
}
