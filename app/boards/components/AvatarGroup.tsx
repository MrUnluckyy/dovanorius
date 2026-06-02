import { avatarUrl } from "@/lib/avatar";

export function AvatarGroup({
  members,
}: {
  members: { avatar: string | null; name: string | null; role: string }[];
}) {
  return (
    <div className="avatar-group -space-x-4">
      {members.map((member, i) => (
        <div key={`${member.name ?? "guest"}-${i}`} className="avatar">
          <div className="w-6">
            <img
              src={avatarUrl(member.avatar, member.name)}
              alt={member.name || "User Avatar"}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
