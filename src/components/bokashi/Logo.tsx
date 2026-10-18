import { cn } from "@/lib/utils";

export interface LogoProps {
  variant?: "horizontal" | "stacked" | "icon";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Logo({
  variant = "horizontal",
  size = "md",
  className,
}: LogoProps) {
  if (variant === "icon") {
    const iconSize =
      size === "sm" ? "h-6 w-6" : size === "lg" ? "h-11 w-11" : "h-8 w-8";
    return (
      <img
        src="/bokashipay-icon.png"
        alt="BokashiPay"
        className={cn("shrink-0 object-contain select-none", iconSize, className)}
      />
    );
  }

  if (variant === "stacked") {
    const stackedHeight =
      size === "sm" ? "h-14" : size === "lg" ? "h-24" : "h-20";
    return (
      <div className={cn("inline-flex flex-col items-center", className)}>
        <img
          src="/bokashipay-logo-dark.png"
          alt="BokashiPay"
          className={cn("w-auto object-contain select-none", stackedHeight)}
        />
      </div>
    );
  }

  const iconHeight =
    size === "sm" ? "h-7 w-7" : size === "lg" ? "h-10 w-10" : "h-8 w-8";
  const wordmarkHeight =
    size === "sm" ? "h-4" : size === "lg" ? "h-6" : "h-[19px]";

  return (
    <div className={cn("inline-flex items-center gap-2.5", className)}>
      <img
        src="/bokashipay-icon.png"
        alt="BokashiPay"
        className={cn("shrink-0 object-contain select-none", iconHeight)}
      />
      <img
        src="/bokashipay-wordmark-dark.png"
        alt="BokashiPay"
        className={cn("w-auto object-contain select-none", wordmarkHeight)}
      />
    </div>
  );
}
