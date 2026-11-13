import type { CSSProperties, FC } from "react";
import { Img, staticFile } from "remotion";

import { DARK, LOGO, PRODUCT_NAME } from "../brand";
import { HEADING } from "../fonts";

/** Height of the logo box at a given width: the logo's own aspect, or a wordmark line without one. */
export function logoHeight(width: number): number {
  return Math.round(width * (LOGO ? LOGO.aspect : 0.2));
}

/** The profile's logo, or the product name set as a wordmark when the profile has none. */
export const Logo: FC<{ width: number; style?: CSSProperties }> = ({ width, style }) => {
  const height = logoHeight(width);
  if (LOGO) {
    return <Img src={staticFile(LOGO.src)} style={{ width, height, objectFit: "contain", ...style }} />;
  }
  return (
    <div
      style={{
        width,
        height,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: HEADING,
        fontWeight: 700,
        fontSize: Math.round(height * 0.62),
        letterSpacing: "-0.03em",
        color: DARK,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {PRODUCT_NAME}
    </div>
  );
};
