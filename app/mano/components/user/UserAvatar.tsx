import { LuUserRound } from "react-icons/lu";
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
        className={`bg-(--nr-tile) text-(--nr-gold-strong) w-${
          size || 24
        } rounded-full`}
      >
        <LuUserRound className="h-1/2 w-1/2" aria-hidden />
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
