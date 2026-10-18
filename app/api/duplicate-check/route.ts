import { NextRequest, NextResponse } from "next/server";
import { checkFamilyDuplicates } from "@/lib/duplicates/checker";
import { getCurrentUser } from "@/lib/auth/auth-helpers";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { mobile, sanghId, excludeFamilyId, members } = body;

    if (!mobile || !sanghId) {
      return NextResponse.json(
        { error: "Mobile number and Sangh ID are required" },
        { status: 400 }
      );
    }

    const result = await checkFamilyDuplicates({
      mobile,
      sanghId,
      excludeFamilyId,
      members,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Duplicate check error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
