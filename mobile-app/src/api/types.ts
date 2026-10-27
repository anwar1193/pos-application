export type MobileUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  lastLoginAt: string | null;
};

export type MobileOrganization = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  currency: string;
};

export type MobileMembership = {
  id: string;
  roleId: string;
  roleCode: string;
  roleName: string;
  defaultBranchId: string | null;
  status: string;
};

export type SessionPayload = {
  user: MobileUser;
  organization: MobileOrganization;
  membership: MobileMembership;
  permissions: string[];
};

export type LoginPayload = SessionPayload & {
  token: string;
  expiresAt: string;
};

export type LogoutPayload = {
  ok: boolean;
};

export type DashboardShift = {
  id: string;
  openedAt: string;
  openingAmount: number;
  expectedAmount: number;
  transactionCount: number;
  grossTotal: number;
  cashierName: string;
  branchName: string | null;
};

export type DashboardRecentSale = {
  id: string;
  receiptNumber: string;
  customerName: string | null;
  grandTotal: number;
  status: string;
  soldAt: string;
};

export type DashboardToday = {
  net: number;
  transactions: number;
  itemsSold: number;
  comparison: {
    grossPercent: number | null;
    transactionsPercent: number | null;
  };
};

export type DashboardPayload = {
  user: { name: string };
  organization: { name: string; currency: string; timezone: string };
  branch: { id: string; name: string };
  dateLabel: string;
  shift: DashboardShift | null;
  today: DashboardToday;
  recentSales: DashboardRecentSale[];
};
