export function useRouter() {
  return {
    push: (url: string) => console.log("[Storybook] router.push:", url),
    replace: (url: string) => console.log("[Storybook] router.replace:", url),
    back: () => console.log("[Storybook] router.back"),
    forward: () => console.log("[Storybook] router.forward"),
    refresh: () => console.log("[Storybook] router.refresh"),
    prefetch: () => Promise.resolve(),
  };
}

export function usePathname() {
  return "/storybook";
}

export function useSearchParams() {
  return new URLSearchParams();
}

export function useParams() {
  return {};
}
