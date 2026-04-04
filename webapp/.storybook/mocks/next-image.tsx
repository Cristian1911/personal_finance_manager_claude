/* eslint-disable @typescript-eslint/no-explicit-any */
export default function Image(props: any) {
  const { fill, ...rest } = props;
  return (
    <img
      {...rest}
      style={fill ? { objectFit: "cover", width: "100%", height: "100%" } : undefined}
    />
  );
}
