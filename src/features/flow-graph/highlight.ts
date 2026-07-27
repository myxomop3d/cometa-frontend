/**
 * A link is highlighted when the user is hovering a link whose cross_guid
 * matches. Group-by-equality — a shared cross_guid means the links are one
 * continuation path through a proxy node.
 */
export function isHighlighted(
  edgeCrossGuid: string | undefined,
  hoveredCrossGuid: string | null,
): boolean {
  return hoveredCrossGuid != null && edgeCrossGuid === hoveredCrossGuid;
}
