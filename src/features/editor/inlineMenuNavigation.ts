export function inlineMenuNavigation(
  dom: HTMLElement,
  buttons: HTMLButtonElement[],
  selected: number,
  triggerSelector: string,
  close: (focusEditor: boolean) => void,
) {
  const owner = dom.ownerDocument;
  const dismiss = (event: PointerEvent) => {
    const target = event.target;
    if (target instanceof Element && (dom.contains(target) || target.closest(triggerSelector))) return;
    close(false);
  };
  dom.addEventListener("keydown", event => {
    if (event.key === "Escape" || event.key === "Tab") {
      event.preventDefault();
      close(true);
      return;
    }
    const current = buttons.findIndex(button => button === owner.activeElement);
    const next = { ArrowUp: current - 1, ArrowDown: current + 1, Home: 0, End: buttons.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    buttons[(next + buttons.length) % buttons.length]?.focus();
  });
  return {
    dom,
    mount() {
      owner.addEventListener("pointerdown", dismiss, true);
      buttons[selected]?.focus({ preventScroll: true });
    },
    destroy() { owner.removeEventListener("pointerdown", dismiss, true); },
  };
}
