export function Avatar({
  avatar_url,
  name,
  size = 24,
}: {
  avatar_url?: string | null;
  name?: string | null;
  size?: number;
}) {
  if (avatar_url) {
    return (
      <div className="avatar shrink-0">
        <div className={`rounded-full w-${size}`}>
          <img
            src={avatar_url}
            alt={name ?? "User Avatar"}
            className="shrink-0"
          />
        </div>
      </div>
    );
  }
  if (!avatar_url && name) {
    return (
      <div className="avatar avatar-placeholder shrink-0">
        <div
          className={`bg-neutral text-neutral-content w-${size} rounded-full`}
        >
          <span className="text-3xl">{name.charAt(0)}</span>
        </div>
      </div>
    );
  }
  return (
    <div className="avatar avatar-placeholder shrink-0">
      <div className={`bg-neutral text-neutral-content w-${24} rounded-full`}>
        <span className="text-3xl">USR</span>
      </div>
    </div>
  );
}
