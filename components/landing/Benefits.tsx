import React from "react";

export default function Benefits() {
  return (
    <div className=" mx-auto px-8 py-8 mt-20 relative">
      <div className="absolute top-0 left-0 w-[90%] bottom-0 -z-10 bg-secondary rounded-br-[200px] rounded-tr-[200px]" />
      <div className="max-w-[1440px] mx-auto">
        <h2 className="text-4xl font-heading">Kuo tai naudinga?</h2>
        <div className="flex flex-col md:flex-row justify-center gap-20 mt-10 items-center">
          <div className="flex-1">
            <div className="mockup-phone max-w-96">
              <div className="mockup-phone-camera"></div>
              <div className="mockup-phone-display text-white grid place-content-center bg-neutral-900">
                It's Glowtime.
              </div>
            </div>
          </div>
          <div>
            <div className="mb-8">
              <h3 className="font-heading text-3xl mb-4">
                Nėra pasikartojančių dovanų!
              </h3>
              <p className="font-body">
                Niekas nenori gauti trijų tokių pačių puodelių (nebent labai
                mėgsti puodelius). Rezervavimas išsprendžia viską.
              </p>
            </div>
            <div className="mb-8">
              <h3 className="font-heading text-3xl mb-4">
                Bendros norų lentos? Taip!
              </h3>
              <p className="font-body">
                Tobula šventėms, šeimos renginiams, Kalėdoms, vaikams ar
                bendroms idėjoms. Vienas sąrašas — daug laimingų žmonių.
              </p>
            </div>
            <div className="mb-8">
              <h3 className="font-heading text-3xl mb-4">Norimos dovanos</h3>
              <p className="font-body">
                Gaukite tai, ko iš tikrųjų norite ir reikia. Jokių daugiau
                nepageidaujamų dovanų!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
