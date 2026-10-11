// ORION UAV Design Challenge — Official Rulebook, Section 13.1 (Judging & Scoring).
// Each criterion's weight equals its marks out of the 100-mark rubric.

export const CRITERIA = [
  {
    key: "innovation",
    label: "Innovation & Creativity",
    weight: 25,
    look: "An original, sensible approach to the assigned problem",
  },
  {
    key: "technical",
    label: "Technical Complexity & Feasibility",
    weight: 20,
    look: "Engineering depth across aerodynamics, avionics and software; analysis that backs the claims; a realistic design",
  },
  {
    key: "relevance",
    label: "Problem Relevance",
    weight: 15,
    look: "How well the design answers its brief and the real need behind it",
  },
  {
    key: "scalability",
    label: "Scalability",
    weight: 15,
    look: "Potential to grow: modularity, manufacturability, cost, wider deployment",
  },
  {
    key: "presentation",
    label: "Presentation & Pitching",
    weight: 15,
    look: "Clarity, structure, teamwork in delivery, handling of questions",
  },
  {
    key: "cad",
    label: "CAD Detailing",
    weight: 10,
    look: "Model accuracy, assembly quality, drawings, level of detail",
  },
] as const;

export type CriterionKey = (typeof CRITERIA)[number]["key"];

export const RUBRIC_TOTAL = 100;

/** Judges may award half marks. */
export const MARK_STEP = 0.5;

/** 5.2 Interdisciplinary Bonus is capped at 5 marks. */
export const BONUS_MAX = 5;

/** 13.3 "may review large gaps between their scores" — flag gaps above this many marks. */
export const GAP_REVIEW_MARKS = 15;

/** 13.3 At least 2 judges per track score each crew. */
export const MIN_JUDGES = 2;

export const TRACKS = {
  senior: "Senior Track",
  first_year: "First-Year Special Track",
} as const;

export type Track = keyof typeof TRACKS;

export function isTrack(value: unknown): value is Track {
  return value === "senior" || value === "first_year";
}
