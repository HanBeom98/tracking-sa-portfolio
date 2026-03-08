export function bindGenderButtons(buttons, onGenderChanged) {
  if (!Array.isArray(buttons) || buttons.length === 0) return;

  buttons.forEach((button) => {
    button.onclick = () => {
      buttons.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");
      onGenderChanged?.(button.dataset.gender || "male");
    };
  });
}
