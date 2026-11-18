// Браузер может отдавать дробную прокрутку: запас в пару пикселей, чтобы край ленты считался краем.
const EDGE_TOLERANCE_PX = 2;

export function scrollEdges(scrollLeft: number, clientWidth: number, scrollWidth: number) {
  return {
    atStart: scrollLeft <= EDGE_TOLERANCE_PX,
    atEnd: scrollLeft + clientWidth >= scrollWidth - EDGE_TOLERANCE_PX,
  };
}
