"use client";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export default function AutoPrint() {
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams.get("autoprint")) {
      window.print();
    }
  }, [searchParams]);
  return null;
}
