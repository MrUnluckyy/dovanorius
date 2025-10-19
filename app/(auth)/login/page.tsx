import { createClient } from "@/utils/supabase/server";
import { LoginForm } from "../components/LoginForm";
import { redirect } from "next/navigation";

export default async function Login() {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (user) {
    redirect("/" + user.id + "/wishlist");
  }

  return (
    <main>
      <div className="hero bg-base-200 min-h-screen">
        <div className="hero-content flex-col lg:flex-row-reverse">
          <div className="text-center lg:text-left">
            <h1 className="text-5xl font-bold">Login</h1>
            <p className="py-6 max-w-prose">
              Gifting is not about the thing you give — it is about the thought
              that says, <i>I see you</i>, <i>I know you</i>, and <i>I care</i>.
            </p>
          </div>
          <div className="card bg-base-100 w-full max-w-sm shrink-0 shadow-2xl">
            <div className="card-body">
              <LoginForm />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
