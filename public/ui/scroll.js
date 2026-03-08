export function scrollIntoViewNearest(element) {
  element?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
