import { RegisterForm } from "../components/RegisterForm";

export default function Register() {
  return (
    <main>
      <div className="hero bg-base-200 min-h-screen">
        <div className="hero-content flex-col lg:flex-row-reverse">
          <div className="text-center lg:text-left">
            <h1 className="text-5xl font-bold">Register</h1>
            <p className="py-6 max-w-prose">
              Gifting is nott about the thing you give — it is about the thought
              that says, <i>I see you</i>, <i>I know you</i>, and <i>I care</i>.
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
