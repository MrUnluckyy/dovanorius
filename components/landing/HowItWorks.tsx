import React from "react";

export default function HowItWorks() {
  return (
    <div className="max-w-[1440px] mx-auto px-8 mt-30">
      <div className="flex flex-col md:flex-row gap-4 mt-10 items-start">
        <div className="card bg-transparent flex-1">
          <figure className="rounded-2xl">
            <img
              src="https://img.daisyui.com/images/stock/photo-1606107557195-0e29a4b5b4aa.webp"
              alt="Shoes"
            />
          </figure>
          <div className="card-body justify-center align-center text-center">
            <h2 className="font-heading text-2xl font-bold">Konkretūs norai</h2>
            <p className="line-clamp-2 text-neutral">
              Išsisaugok konkrečius daiktus ar patirtis kurių nori
            </p>
          </div>
        </div>
        <div className="card bg-transparent flex-1">
          <figure className="rounded-2xl">
            <img
              src="https://img.daisyui.com/images/stock/photo-1606107557195-0e29a4b5b4aa.webp"
              alt="Shoes"
            />
          </figure>
          <div className="card-body justify-center align-center text-center">
            <h2 className="font-heading text-2xl font-bold">Norų lentos</h2>
            <p className="line-clamp-2 text-neutral">
              Sugrupuok visus norus pagal temą ir pasidalik juo su šeima ar
              draugais
            </p>
          </div>
        </div>
        <div className="card bg-transparent flex-1">
          <figure className="rounded-2xl">
            <img
              src="https://img.daisyui.com/images/stock/photo-1606107557195-0e29a4b5b4aa.webp"
              alt="Shoes"
            />
          </figure>
          <div className="card-body justify-center align-center text-center">
            <h2 className="font-heading text-2xl font-bold">
              Dovanų keitimasis
            </h2>
            <p className="line-clamp-2 text-neutral">
              Susibūrimas, šventė ar kita proga, prie kurios jungsime norus.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
