declare module "react-native-view-shot" {
  import * as React from "react";
  import type { ReactNode } from "react";

  export type CaptureOptions = {
    format?: "jpg" | "png" | "webm";
    quality?: number;
    result?: "tmpfile" | "base64" | "data-uri" | "zip-base64";
  };

  export type ViewShotProps = {
    children?: ReactNode;
    options?: CaptureOptions;
    style?: unknown;
  };

  export default class ViewShot extends React.Component<ViewShotProps> {
    capture: () => Promise<string>;
  }
}
