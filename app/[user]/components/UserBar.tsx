import React from "react";

export function UserBar() {
  return (
    <div className="flex gap-4 justify-between">
      <div className="flex gap-12">
        <div className="avatar">
          <div className="w-40 rounded-full">
            <img src="https://img.daisyui.com/images/profile/demo/yellingcat@192.webp" />
          </div>
        </div>
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-2xl font-semibold mb-2">Justas Sobutas</h2>
            <p className="text-sm">
              I like sports, especially cycling and running. I want to camp
              more. See my wishlist below:
            </p>
          </div>
          <div>
            <h2 className="text-2xl font-semibold mb-2">Justas Sobutas</h2>
            <p className="text-sm">
              I like sports, especially cycling and running. I want to camp
              more. See my wishlist below:
            </p>
          </div>
        </div>
      </div>
      <div>
        <button className="btn">Share</button>
      </div>
    </div>
  );
}
