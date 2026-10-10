export type LateReason = "deadline_passed" | "admin_closed" | "both";

export type FieldName =
  | "teamName"
  | "projectTitle"
  | "description"
  | "repoUrl"
  | "demoUrl";

export type SubmitState =
  | { status: "idle" }
  | {
      status: "error";
      message?: string;
      errors: Partial<Record<FieldName, string>>;
      values: Partial<Record<FieldName, string>>;
    }
  | {
      status: "success";
      id: number;
      submittedAt: string;
      isLate: boolean;
      lateReason: LateReason | null;
    };

export type Submission = {
  id: number;
  team_name: string;
  project_title: string;
  description: string;
  repo_url: string;
  demo_url: string;
  is_late: boolean;
  late_reason: LateReason | null;
  created_at: Date | string;
};

export const LATE_REASON_LABEL: Record<LateReason, string> = {
  deadline_passed: "Submitted after the deadline",
  admin_closed: "Submitted after admin closed submissions",
  both: "Submitted after the deadline and after submissions were closed",
};
