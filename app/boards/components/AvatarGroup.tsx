import { avatarUrl } from "@/lib/avatar";
import { AvatarImg } from "@/components/AvatarImg";

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
            <AvatarImg
              src={member.avatar}
              alt={member.name || "User Avatar"}
              fallback={
                <img
                  src={avatarUrl(null, member.name)}
                  alt={member.name || "User Avatar"}
                />
              }
            />
          </div>
        </div>
      ))}
    </div>
  );
}
