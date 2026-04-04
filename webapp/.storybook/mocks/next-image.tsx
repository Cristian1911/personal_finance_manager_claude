import React from "react";

const Image = React.forwardRef<
  HTMLImageElement,
  React.ImgHTMLAttributes<HTMLImageElement> & {
    src: string;
    alt: string;
    width?: number;
    height?: number;
    fill?: boolean;
  }
>(({ fill, ...props }, ref) => (
  <img
    ref={ref}
    {...props}
    style={fill ? { objectFit: "cover", width: "100%", height: "100%" } : undefined}
  />
));
Image.displayName = "Image";

export default Image;
