import Image from "next/image";
import { cn } from "@/lib/cn";

/** The KROV wordmark — a transparent PNG, so it sits directly on any background. */
export default function Logo({ className }: { className?: string }) {
  return (
    <Image
      src="/images/krov.png"
      alt="KROV"
      width={1182}
      height={555}
      priority
      className={cn("w-auto shrink-0 object-contain", className)}
    />
  );
}
