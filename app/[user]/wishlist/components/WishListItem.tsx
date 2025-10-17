import React from "react";

type Item = {
  image: string;
  title: string;
  price: number;
  url: string;
  description: string;
};

type Props = {
  item: Item;
};

export function WishListItem({ item }: Props) {
  const { image, title, price, description, url } = item;
  return (
    <tr>
      <th>
        <div className="avatar">
          <div className="mask mask-squircle h-12 w-12">
            <img src={image} alt="Avatar Tailwind CSS Component" />
          </div>
        </div>
      </th>
      <td>
        <div>
          <div className="font-bold">{title}</div>
          <div className="text-sm opacity-50">{description}</div>
        </div>
      </td>
      <td>€{price.toFixed(2)}</td>
      <td>
        <a href={url} target="_blank">
          {url}
        </a>
      </td>
      <th>
        <button className="btn btn-ghost btn-xs">details</button>
      </th>
    </tr>
  );
}
