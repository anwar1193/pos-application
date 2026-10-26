export const USER_STATUS_LABELS = {
  active: "Aktif",
  invited: "Diundang",
  suspended: "Nonaktif",
} as const;

export type UserStatus = keyof typeof USER_STATUS_LABELS;

export function isUserStatus(value: string | undefined): value is UserStatus {
  return value === "active" || value === "invited" || value === "suspended";
}

const STATUS_STYLES: Record<UserStatus, string> = {
  active: "bg-success-bg text-success",
  invited: "bg-amber-bg text-amber",
  suspended: "bg-brick-bg text-brick",
};

const STATUS_DOTS: Record<UserStatus, string> = {
  active: "bg-success",
  invited: "bg-amber",
  suspended: "bg-brick",
};

export function statusStyle(status: UserStatus): string {
  return STATUS_STYLES[status];
}

export function statusDot(status: UserStatus): string {
  return STATUS_DOTS[status];
}
