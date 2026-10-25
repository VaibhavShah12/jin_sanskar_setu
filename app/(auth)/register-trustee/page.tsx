import React from "react";
import { prisma } from "@/lib/db/prisma";
import TrusteeRegisterClient from "@/components/TrusteeRegisterClient";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trustee Registration Request | Jin Sanskar Setu",
  description: "Request authorized Sangh trustee access to Jin Sanskar Setu.",
};

export const dynamic = "force-dynamic";

export default async function RegisterTrusteePage() {
  const sanghs = await prisma.sangh.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      prefix: true,
    },
  });

  return (
    <div
      className="container py-4 py-md-5 d-flex align-items-center justify-content-center"
      style={{ minHeight: "85vh" }}
    >
      <div className="col-12 col-sm-10 col-md-8 col-lg-6 col-xl-5">
        <TrusteeRegisterClient sanghs={sanghs} />
      </div>
    </div>
  );
}
