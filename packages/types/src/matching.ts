export interface MatchedRequirement {
  requirementId: string;
  description: string;
}

export interface UnknownRequirement {
  requirementId: string;
  description: string;
  reason: string;
}

export interface MatchResult {
  percentage: number;
  matched: MatchedRequirement[];
  missing: MatchedRequirement[];
  unknown: UnknownRequirement[];
  disclaimer: string;
}
