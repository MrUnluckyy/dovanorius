export function UserAvatar({
  avatarUrl,
  size,
}: {
  avatarUrl?: string | null;
  size?: string;
}) {
  if (avatarUrl) {
    return (
      <div className="avatar">
        <div className={`w-${size || 24} rounded-full`}>
          <img src={avatarUrl} alt="User avatar" />
        </div>
      </div>
    );
  }

  return (
    <div className="avatar avatar-placeholder">
      <div
        className={`bg-neutral text-neutral-content w-${
          size || 24
        } rounded-full`}
      >
        <span className="text-3xl">User</span>
      </div>
    </div>
  );
}
