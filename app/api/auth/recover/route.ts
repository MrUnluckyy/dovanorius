import { NextResponse } from "next/server";
import { recoverPassword } from "@/app/api/email/action";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { success: false, message: "Trūksta el. pašto adreso." },
        { status: 400 }
      );
    }

    const result = await recoverPassword(email);

    return NextResponse.json({ success: result.success });
  } catch (error) {
    console.error("Recover password error:", error);
    return NextResponse.json(
      { success: false, message: "Nepavyko išsiųsti laiško." },
      { status: 500 }
    );
  }
}
