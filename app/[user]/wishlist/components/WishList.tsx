"use client";
import React from "react";
import { WishListItem } from "./WishListItem";
import { AddItemModal } from "./AddItemModal";

const mockWishlistItems = [
  {
    id: 1,
    image:
      "https://images.babycity.lt/images/media/cache/product_details_hd_size/catalog/1/c/0/9/1c09b2a1a908e45595932058d570e3c0858a9259_01_pilot_2_black_KSPILO02BLK00_590253392704300.jpg",
    title: "Vežimėlis",
    price: 179.19,
    url: "https://www.babycity.lt/lt/kinderkraft-sportinis-vezimelis-pilot-2,-juodas,-kspilo02blk0000-3010301-1755",
    description:
      "KINDERKRAFT sportinis vežimėlis PILOT 2, juodas, KSPILO02BLK0000",
  },
  {
    id: 2,
    image:
      "https://www.lora.lt/media/catalog/product/cache/df9e0f86fd74b697896320fe1da78436/i/m/imagestudio_upscale_3.png",
    title: "Ausinės kūdikiams",
    price: 32.0,
    url: "https://www.lora.lt/apsaugines-ausines-kudikiams-alpine-muffy-baby-new",
    description: "Apsauginės ausinės kūdikiams ALPINE MUFFY BABY NEW",
  },
  {
    id: 3,
    image:
      "https://images.babycity.lt/images/media/cache/product_details_hd_size/catalog/4/5/6/b/456b00614e95ea0f2e6e0e5f42c1e45152811400_44b3da99a3.jpg",
    title: "HOT WHEELS",
    price: 19.99,
    url: "https://www.babycity.lt/lt/hot-wheels-rinkinys-dzipu-persekiojimo-lenktynes,-hxt05-4080501-0590",
    description: "HOT WHEELS rinkinys Džipų persekiojimo lenktynės, HXT05",
  },
];

export function WishList() {
  return (
    <div className="overflow-x-auto">
      <div className="w-full flex justify-end">
        <AddItemModal />
      </div>
      <table className="table">
        <thead>
          <tr>
            <th></th>
            <th>Title</th>
            <th>Price</th>
            <th>Url</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {mockWishlistItems.map((item) => (
            <WishListItem item={item} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
