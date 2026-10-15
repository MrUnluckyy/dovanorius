import { AvatarImg } from "@/components/AvatarImg";

export function UserAvatar({
  avatarUrl,
  size,
}: {
  avatarUrl?: string | null;
  size?: string;
}) {
  const placeholder = (
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

  return (
    <AvatarImg
      src={avatarUrl}
      alt="User avatar"
      fallback={placeholder}
      wrap={(img) => (
        <div className="avatar">
          <div className={`w-${size || 24} rounded-full`}>{img}</div>
        </div>
      )}
    />
  );
}
