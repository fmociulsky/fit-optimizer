export type StudioServicePaymentStatus = "current" | "overdue";

export type ContractedStudioSummary = {
  userId: string;
  gymName: string;
  username: string;
  email: string;
  code: string | null;
  branchCount: number;
  maxBranches: number;
  serviceActive: boolean;
  serviceStartsOn: string;
  serviceEndsOn: string;
  serviceFeeAmount: number | null;
  servicePaymentStatus: StudioServicePaymentStatus;
  serviceLastPaidOn: string;
  /** Adeuda: vencido o marcado overdue. */
  paymentDue: boolean;
  expired: boolean;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  createdAt: string;
};

export type ContractedStudioDetail = ContractedStudioSummary;
