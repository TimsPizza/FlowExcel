import { cn } from "@/lib/utils";
import { Button as RadixButton } from "@radix-ui/themes";
import * as React from "react";

// Re-export the Radix Themes Button
// We can add custom variants or props here later if needed
const Button = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof RadixButton>
>((props, ref) => {
  return (
    <RadixButton
      ref={ref}
      {...props}
      className={cn(props.className, "!cursor-pointer")}
    />
  );
});
Button.displayName = "Button";

export { Button };
