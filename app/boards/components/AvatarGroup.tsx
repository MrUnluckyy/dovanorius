export function AvatarGroup({
  members,
}: {
  members: { avatar: string | null; name: string | null; role: string }[];
}) {
  return (
    <div className="avatar-group -space-x-4">
      {members.map((member) => (
        <div key={member.avatar} className="avatar">
          <div className="w-6">
            <img
              src={member.avatar || "https://picsum.photos/200/300"}
              alt={member.name || "User Avatar"}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
