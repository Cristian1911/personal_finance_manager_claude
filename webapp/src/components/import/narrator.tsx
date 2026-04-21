type Props = {
  children: React.ReactNode;
  tone?: "brass" | "sage";
};

export function Narrator({ children, tone = "brass" }: Props) {
  const color = tone === "brass" ? "text-z-brass" : "text-z-sage-dark";
  return (
    <p className={`mt-4 text-center text-sm italic leading-relaxed ${color}`}>
      {children}
    </p>
  );
}
