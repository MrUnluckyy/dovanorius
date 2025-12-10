"use client";
import Clarity from "@microsoft/clarity";
import { useEffect } from "react";

export default function ClarityProvider() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") {
      Clarity.init("ujhfbpkjx8");
    }
  }, []);

  return null;
}
