import React from "react";

export default function HowItWorks() {
  return (
    <div className="max-w-[1440px] mx-auto px-8">
      <h2 className="text-4xl font-special">Kaip tai veikia?</h2>
      <div className="flex flex-col md:flex-row gap-4 mt-10 items-center">
        <div className="p-8 bg-base-300 shadow-lg rounded-2xl rotate-1 flex-1">
          <h3 className="font-heading text-3xl mb-4">1. Susikurk norų lentą</h3>
          <p className="font-body">
            Sukurk asmeninę norų lentą mūsų platformoje per kelias minutes.
          </p>
        </div>
        <img
          src="/assets/doodles/arrows.png"
          alt="arrow"
          className="w-12 h-12 rotate-90 md:rotate-45"
        />
        <div className="p-8 bg-base-300 shadow-lg rounded-2xl -rotate-2 flex-1">
          <h3 className="font-heading text-3xl mb-4">2. Pridėk norus</h3>
          <p className="font-body">
            Pridėk norimus daiktus, patinkančias patirtis ar tikslus, kuriuos
            nori pasiekti.
          </p>
        </div>

        <img
          src="/assets/doodles/arrows.png"
          alt="arrow"
          className="w-12 h-12 -rotate-90 scale-x-[-1] md:rotate-[120deg]"
        />

        <div className="p-8 bg-base-300 shadow-lg rounded-2xl rotate-2 flex-1">
          <h3 className="font-heading text-3xl mb-4">3. Dalinkis</h3>
          <p className="font-body">
            Pasidalink savo norų lentos nuoroda su draugais ir šeima.
          </p>
        </div>
      </div>
    </div>
  );
}
