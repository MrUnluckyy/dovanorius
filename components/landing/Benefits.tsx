import React from "react";

export default function Benefits() {
  return (
    <div className="max-w-[1440px] mx-auto px-8 mt-20">
      <h2 className="text-4xl font-special">Kuo tai naudinga?</h2>
      <div className="flex flex-col md:flex-row justify-center gap-20 mt-10 items-center">
        <img
          src="/assets/doodles/cat.svg"
          alt="cat illustration"
          className="w-100"
        />
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
              Tobula šventėms, šeimos renginiams, Kalėdoms, vaikams ar bendroms
              idėjoms. Vienas sąrašas — daug laimingų žmonių.
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
  );
}
