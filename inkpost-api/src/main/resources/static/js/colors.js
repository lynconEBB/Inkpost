// A rule's color, picked from a palette by its ID, so a rule has the same color in the rule list and on the
// timeline without storing one (D39). No DOM.

/** The default rule is always neutral, so it reads as the background the other rules sit on. */
export const DEFAULT_COLOR = "#6b7280";

/**
 * Dark enough for at least 4.5:1 against white, so the timeline's hatching (stripes of the color on white)
 * stands apart from its solid fill in every color.
 */
export const PALETTE = [
	"#1d4ed8", // blue
	"#b91c1c", // red
	"#047857", // green
	"#7e22ce", // purple
	"#c2410c", // orange
	"#0e7490", // teal
	"#be185d", // pink
	"#4d7c0f", // olive
];

export function ruleColor(rule) {
	return rule.isDefault ? DEFAULT_COLOR : PALETTE[rule.id % PALETTE.length];
}
