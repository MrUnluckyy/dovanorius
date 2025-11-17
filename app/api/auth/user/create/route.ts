import { signUp } from "@/app/api/email/action";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { email, password, displayName } = await req.json();

    if (!email || !password || !displayName) {
      return NextResponse.json(
        { success: false, message: "Trūksta privalomų laukų." },
        { status: 400 }
      );
    }

    const result = await signUp(email, password, displayName);

    return NextResponse.json({ success: result.success });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { success: false, message: "Nepavyko sukurti paskyros." },
      { status: 500 }
    );
  }
}
