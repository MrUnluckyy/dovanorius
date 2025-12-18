import { useTranslations } from "next-intl";
import { RegisterForm } from "../components/RegisterForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Noriuto.lt - registruokis",
  description:
    "Prisiregistruokite prie Noriuto.lt ir pradėkite kurti savo norų sąrašus bei dalintis jais su draugais ir šeima.",
};

export default function Register() {
  return (
    <main>
      <div className="hero bg-base-200 min-h-screen">
        <div className="hero-content flex-col lg:flex-row-reverse">
          <div className="text-center lg:text-left w-full px-4 md:min-w-md">
            <h1 className="text-5xl font-bold font-special">Registruokis!</h1>
            <p className="py-6 max-w-prose font-heading">
              Prisiregistruokite prie Noriuto.lt ir pradėkite kurti savo norų
              sąrašus bei dalintis jais su draugais ir šeima.
            </p>
          </div>
          <div className="card bg-base-100 w-full max-w-sm shrink-0 shadow-2xl">
            <div className="card-body">
              <RegisterForm />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
