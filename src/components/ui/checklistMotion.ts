const running = new WeakMap<HTMLElement, Animation>();

export function animateChecklistToggle(control: HTMLElement, checked: boolean) {
  running.get(control)?.cancel();
  if (typeof control.animate !== "function" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  running.set(control, control.animate(
    [{ scale: "1" }, { scale: checked ? "1.12" : "1.06", offset: .42 }, { scale: "1" }],
    { duration: 140, easing: "ease-out" },
  ));
}
