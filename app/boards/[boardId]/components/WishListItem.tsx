import React from "react";
import { Item } from "./WishList";
import { ItemActions } from "./ActionItem";

type Props = {
  item: Item;
  boardId: string;
};

export function WishListItem({ item, boardId }: Props) {
  const { title, url, notes } = item;
  return (
    <tr>
      <th>
        <div className="avatar">
          <div className="mask mask-squircle h-12 w-12">
            <img
              src="/assets/placeholder.jpg"
              alt="Avatar Tailwind CSS Component"
            />
          </div>
        </div>
      </th>
      <td>
        <div>
          <div className="font-bold">{title}</div>
          <div className="text-sm opacity-50">{notes}</div>
        </div>
      </td>
      <td>-</td>
      <td>
        {url ? (
          <a href={url} target="_blank">
            {url}
          </a>
        ) : (
          "-"
        )}
      </td>
      <th>
        <ItemActions boardId={boardId} itemId={item.id} />
      </th>
    </tr>
  );
}
