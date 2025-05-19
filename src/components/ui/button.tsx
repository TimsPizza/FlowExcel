import { Button as RadixButton } from "@radix-ui/themes";
import * as React from "react";

// Re-export the Radix Themes Button
// We can add custom variants or props here later if needed
const Button = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof RadixButton>
>((props, ref) => {
  return <RadixButton ref={ref} {...props} />;
});
Button.displayName = "Button";

export { Button };
